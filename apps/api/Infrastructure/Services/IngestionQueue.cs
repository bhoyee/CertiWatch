using System.Runtime.CompilerServices;
using System.Text.Json;
using CertiWatch.Contracts.Events;
using StackExchange.Redis;

namespace CertiWatch.Api.Infrastructure.Services;

public interface IIngestionQueue
{
    ValueTask EnqueueAsync(DocumentDetectedEvent payload, CancellationToken cancellationToken = default);
    IAsyncEnumerable<DocumentDetectedEvent> ReadAllAsync(CancellationToken cancellationToken);
}

// Backed by a Redis stream + consumer group instead of an in-process Channel: a plain in-memory
// queue only works as long as exactly one API instance ever runs, since anything enqueued lives
// only in that process's heap - invisible to any other replica, and gone outright on a restart
// or scale-down. A consumer group makes every API replica a competing consumer of the same
// stream (each entry goes to exactly one of them, not all), and entries stay in Redis - and in
// the group's pending list - until explicitly acknowledged, so a replica that dies mid-processing
// leaves its in-flight entries to be reclaimed rather than silently dropped.
public sealed class RedisIngestionQueue : IIngestionQueue
{
    private const string StreamKey = "ingestion:documents";
    private const string GroupName = "ingestion-workers";
    private static readonly TimeSpan MinIdleBeforeReclaim = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan PollDelay = TimeSpan.FromSeconds(1);

    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisIngestionQueue> _logger;
    private readonly string _consumerName = $"{Environment.MachineName}:{Environment.ProcessId}:{Guid.NewGuid():N}";

    public RedisIngestionQueue(IConnectionMultiplexer redis, ILogger<RedisIngestionQueue> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    public async ValueTask EnqueueAsync(DocumentDetectedEvent payload, CancellationToken cancellationToken = default)
    {
        var db = _redis.GetDatabase();
        var json = JsonSerializer.Serialize(payload);
        await db.StreamAddAsync(StreamKey, "payload", json);
    }

    public async IAsyncEnumerable<DocumentDetectedEvent> ReadAllAsync([EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var db = _redis.GetDatabase();
        // Tracked as local state rather than ensured once up front: this whole method runs inside
        // a BackgroundService, and .NET stops the entire host if a BackgroundService's ExecuteAsync
        // throws unhandled - so a Redis outage at the moment this starts (or at any later point,
        // if the group vanishes) must never propagate out of this loop. It has to be something
        // this loop can retry past indefinitely, not a one-shot call that can crash the app.
        var groupReady = false;

        while (!cancellationToken.IsCancellationRequested)
        {
            if (!groupReady)
            {
                groupReady = await TryEnsureGroupAsync(db);
                if (!groupReady)
                {
                    await Task.Delay(PollDelay, cancellationToken);
                    continue;
                }
            }

            // Pick up anything left pending by a consumer (this one or a since-dead replica)
            // that never acknowledged it, before asking for fresh work.
            var reclaimed = await ReclaimStaleEntriesAsync(db, onMissingGroup: () => groupReady = false);
            var entries = reclaimed.Length > 0 ? reclaimed : await ReadNewEntriesAsync(db, onMissingGroup: () => groupReady = false);

            if (entries.Length == 0)
            {
                await Task.Delay(PollDelay, cancellationToken);
                continue;
            }

            foreach (var entry in entries)
            {
                var payload = TryDeserialize(entry);
                if (payload is not null)
                {
                    yield return payload;
                }

                await AcknowledgeAsync(db, entry.Id);
            }
        }
    }

    private async Task<StreamEntry[]> ReadNewEntriesAsync(IDatabase db, Action onMissingGroup)
    {
        try
        {
            return await db.StreamReadGroupAsync(StreamKey, GroupName, _consumerName, StreamPosition.NewMessages, count: 10);
        }
        catch (RedisServerException ex) when (IsMissingGroup(ex))
        {
            _logger.LogWarning("Ingestion stream or consumer group is missing (likely deleted externally); will recreate");
            onMissingGroup();
            return Array.Empty<StreamEntry>();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis ingestion stream read failed; will retry");
            return Array.Empty<StreamEntry>();
        }
    }

    private async Task<StreamEntry[]> ReclaimStaleEntriesAsync(IDatabase db, Action onMissingGroup)
    {
        try
        {
            var pending = await db.StreamPendingMessagesAsync(StreamKey, GroupName, count: 10, consumerName: RedisValue.Null);
            var staleIds = pending
                .Where(p => p.IdleTimeInMilliseconds >= MinIdleBeforeReclaim.TotalMilliseconds)
                .Select(p => p.MessageId)
                .ToArray();

            if (staleIds.Length == 0)
            {
                return Array.Empty<StreamEntry>();
            }

            _logger.LogWarning("Reclaiming {Count} stale ingestion stream entries for consumer {Consumer}", staleIds.Length, _consumerName);
            return await db.StreamClaimAsync(StreamKey, GroupName, _consumerName, (long)MinIdleBeforeReclaim.TotalMilliseconds, staleIds);
        }
        catch (RedisServerException ex) when (IsMissingGroup(ex))
        {
            _logger.LogWarning("Ingestion stream or consumer group is missing (likely deleted externally); will recreate");
            onMissingGroup();
            return Array.Empty<StreamEntry>();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to check/reclaim stale ingestion stream entries");
            return Array.Empty<StreamEntry>();
        }
    }

    private static bool IsMissingGroup(RedisServerException ex)
        => ex.Message.Contains("NOGROUP", StringComparison.OrdinalIgnoreCase);

    private async Task<bool> TryEnsureGroupAsync(IDatabase db)
    {
        try
        {
            await EnsureGroupAsync(db);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not reach Redis to set up the ingestion stream/group; will retry");
            return false;
        }
    }

    private async Task AcknowledgeAsync(IDatabase db, RedisValue entryId)
    {
        try
        {
            await db.StreamAcknowledgeAsync(StreamKey, GroupName, entryId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to acknowledge ingestion stream entry {EntryId}", entryId);
        }
    }

    private DocumentDetectedEvent? TryDeserialize(StreamEntry entry)
    {
        try
        {
            var json = entry["payload"];
            return json.IsNullOrEmpty ? null : JsonSerializer.Deserialize<DocumentDetectedEvent>(json!);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dropping unreadable ingestion stream entry {EntryId}", entry.Id);
            return null;
        }
    }

    private static async Task EnsureGroupAsync(IDatabase db)
    {
        try
        {
            // Start from the beginning, not "new messages only" ($): if the group ever has to be
            // (re)created while entries already sit in the stream - the very scenario this exists
            // to handle, e.g. the group having been deleted out from under a running consumer -
            // starting at $ would silently skip everything already queued instead of delivering it.
            await db.StreamCreateConsumerGroupAsync(StreamKey, GroupName, StreamPosition.Beginning, createStream: true);
        }
        catch (RedisServerException ex) when (ex.Message.Contains("BUSYGROUP", StringComparison.OrdinalIgnoreCase))
        {
            // Group already exists from a previous run/replica - that's the expected steady state.
        }
    }
}
