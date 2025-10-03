import type { Env, LogEntry, LogEntryRequest, LogEntriesResponse } from '../types.js';

export class LogService {
  constructor(private env: Env) {}

  /**
   * Store a log entry in D1
   */
  async storeLogEntry(logRequest: LogEntryRequest, sourceIp?: string, userAgent?: string): Promise<LogEntriesResponse> {
    const logId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    try {
      const stmt = this.env.DB.prepare(`
        INSERT INTO log_entries (
          log_id, timestamp, level, logger_name, message, module,
          function_name, line_number, thread_id, process_id, extra_data,
          source_ip, user_agent, request_id, correlation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(
        logId,
        timestamp,
        logRequest.level,
        logRequest.loggerName || null,
        logRequest.message,
        logRequest.module || null,
        logRequest.functionName || null,
        logRequest.lineNumber || null,
        logRequest.threadId || null,
        logRequest.processId || null,
        logRequest.extraData ? JSON.stringify(logRequest.extraData) : null,
        sourceIp || null,
        userAgent || null,
        logRequest.requestId || null,
        logRequest.correlationId || null
      ).run();

      return {
        success: true,
        message: 'Log entry stored successfully',
        logId
      };
    } catch (error) {
      console.error('Error storing log entry:', error);
      return {
        success: false,
        message: `Failed to store log entry: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Store multiple log entries in batch
   */
  async storeLogEntries(logRequests: LogEntryRequest[], sourceIp?: string, userAgent?: string): Promise<LogEntriesResponse> {
    const logIds: string[] = [];
    const timestamp = new Date().toISOString();

    try {
      // Use a transaction for batch insert
      const stmt = this.env.DB.prepare(`
        INSERT INTO log_entries (
          log_id, timestamp, level, logger_name, message, module,
          function_name, line_number, thread_id, process_id, extra_data,
          source_ip, user_agent, request_id, correlation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const logRequest of logRequests) {
        const logId = crypto.randomUUID();
        logIds.push(logId);

        await stmt.bind(
          logId,
          timestamp,
          logRequest.level,
          logRequest.loggerName || null,
          logRequest.message,
          logRequest.module || null,
          logRequest.functionName || null,
          logRequest.lineNumber || null,
          logRequest.threadId || null,
          logRequest.processId || null,
          logRequest.extraData ? JSON.stringify(logRequest.extraData) : null,
          sourceIp || null,
          userAgent || null,
          logRequest.requestId || null,
          logRequest.correlationId || null
        ).run();
      }

      return {
        success: true,
        message: `Stored ${logRequests.length} log entries successfully`,
        count: logRequests.length
      };
    } catch (error) {
      console.error('Error storing log entries:', error);
      return {
        success: false,
        message: `Failed to store log entries: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get log entries with optional filtering
   */
  async getLogEntries(
    limit: number = 100,
    offset: number = 0,
    level?: string,
    loggerName?: string,
    startDate?: string,
    endDate?: string,
    requestId?: string,
    correlationId?: string
  ): Promise<LogEntriesResponse> {
    try {
      let whereConditions: string[] = [];
      let params: any[] = [];

      if (level) {
        whereConditions.push('level = ?');
        params.push(level);
      }

      if (loggerName) {
        whereConditions.push('logger_name = ?');
        params.push(loggerName);
      }

      if (startDate) {
        whereConditions.push('timestamp >= ?');
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push('timestamp <= ?');
        params.push(endDate);
      }

      if (requestId) {
        whereConditions.push('request_id = ?');
        params.push(requestId);
      }

      if (correlationId) {
        whereConditions.push('correlation_id = ?');
        params.push(correlationId);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const stmt = this.env.DB.prepare(`
        SELECT
          log_id as logId,
          timestamp,
          level,
          logger_name as loggerName,
          message,
          module,
          function_name as functionName,
          line_number as lineNumber,
          thread_id as threadId,
          process_id as processId,
          extra_data as extraData,
          source_ip as sourceIp,
          user_agent as userAgent,
          request_id as requestId,
          correlation_id as correlationId
        FROM log_entries
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `);

      const result = await stmt.bind(...params, limit, offset).all();
      const entries = (result.results || []) as unknown as LogEntry[];

      return {
        success: true,
        message: `Retrieved ${entries.length} log entries`,
        count: entries.length,
        entries
      };
    } catch (error) {
      console.error('Error retrieving log entries:', error);
      return {
        success: false,
        message: `Failed to retrieve log entries: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Clean up expired log entries (older than 30 days)
   */
  async cleanupExpiredLogs(): Promise<LogEntriesResponse> {
    try {
      const stmt = this.env.DB.prepare(`
        DELETE FROM log_entries WHERE expires_at < datetime('now')
      `);

      const result = await stmt.run();
      const deletedCount = result.meta?.changes || 0;

      return {
        success: true,
        message: `Cleaned up ${deletedCount} expired log entries`,
        count: deletedCount
      };
    } catch (error) {
      console.error('Error cleaning up expired logs:', error);
      return {
        success: false,
        message: `Failed to clean up expired logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get log statistics
   */
  async getLogStatistics(): Promise<{
    totalEntries: number;
    entriesByLevel: Record<string, number>;
    entriesByLogger: Record<string, number>;
    oldestEntry: string | null;
    newestEntry: string | null;
  }> {
    try {
      // Total entries
      const totalStmt = this.env.DB.prepare('SELECT COUNT(*) as count FROM log_entries');
      const totalResult = await totalStmt.first() as { count: number };

      // Entries by level
      const levelStmt = this.env.DB.prepare(`
        SELECT level, COUNT(*) as count
        FROM log_entries
        GROUP BY level
      `);
      const levelResults = await levelStmt.all();
      const entriesByLevel: Record<string, number> = {};
      (levelResults.results || []).forEach((row: any) => {
        entriesByLevel[row.level] = row.count;
      });

      // Entries by logger
      const loggerStmt = this.env.DB.prepare(`
        SELECT logger_name, COUNT(*) as count
        FROM log_entries
        WHERE logger_name IS NOT NULL
        GROUP BY logger_name
        ORDER BY count DESC
        LIMIT 10
      `);
      const loggerResults = await loggerStmt.all();
      const entriesByLogger: Record<string, number> = {};
      (loggerResults.results || []).forEach((row: any) => {
        entriesByLogger[row.logger_name] = row.count;
      });

      // Date range
      const dateStmt = this.env.DB.prepare(`
        SELECT
          MIN(timestamp) as oldest,
          MAX(timestamp) as newest
        FROM log_entries
      `);
      const dateResult = await dateStmt.first() as { oldest: string | null; newest: string | null };

      return {
        totalEntries: totalResult.count,
        entriesByLevel,
        entriesByLogger,
        oldestEntry: dateResult.oldest,
        newestEntry: dateResult.newest
      };
    } catch (error) {
      console.error('Error getting log statistics:', error);
      throw new Error(`Failed to get log statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
