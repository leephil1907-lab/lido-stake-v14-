import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Trash2,
  ExternalLink,
  Code,
  Shield,
  Search,
  Filter,
  Check,
  Copy,
  Terminal,
  Activity,
  ArrowRight,
  Server
} from 'lucide-react';
import { getApiLogs, clearApiLogs, ApiLogEntry } from '../lib/apiConfig';

export function ApiLogsPanel() {
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<ApiLogEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadLogs = () => {
    setLogs(getApiLogs());
  };

  useEffect(() => {
    loadLogs();
    const handleUpdate = () => loadLogs();
    window.addEventListener('lido_api_logs_updated', handleUpdate);
    return () => {
      window.removeEventListener('lido_api_logs_updated', handleUpdate);
    };
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filterStatus !== 'ALL' && log.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchWallet = log.wallet?.toLowerCase().includes(q);
      const matchEndpoint = log.endpoint.toLowerCase().includes(q);
      const matchError = log.errorMessage?.toLowerCase().includes(q);
      if (!matchWallet && !matchEndpoint && !matchError) return false;
    }
    return true;
  });

  const totalVerifications = logs.filter((l) => l.endpoint.includes('verify-signature')).length;
  const successfulVerifications = logs.filter((l) => l.endpoint.includes('verify-signature') && l.status === 'SUCCESS').length;
  const failedVerifications = logs.filter((l) => l.endpoint.includes('verify-signature') && l.status === 'FAILED').length;

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all signature and API logs?')) {
      clearApiLogs();
      setSelectedLog(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stat Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-card rounded-2xl border border-border-main shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-text-secondary block">Total Verification Requests</span>
            <span className="text-2xl font-black text-text-main mt-1 block">{totalVerifications}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#00A3FF]/10 text-[#00A3FF] flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-card rounded-2xl border border-border-main shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-text-secondary block">Successful Verifications</span>
            <span className="text-2xl font-black text-emerald-500 mt-1 block">{successfulVerifications}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-card rounded-2xl border border-border-main shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-text-secondary block">Failed / Rejected Attempts</span>
            <span className="text-2xl font-black text-red-500 mt-1 block">{failedVerifications}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-card rounded-2xl border border-border-main shadow-sm overflow-hidden space-y-0">
        <div className="px-6 py-4 border-b border-border-main bg-input/50 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="font-bold text-sm text-text-main flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#00A3FF]" />
              Signature Verification API Request & Response Stream
            </h2>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Live cryptographic signature telemetry, HTTP statuses, latency, payloads, and rejection reasons
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Toggle */}
            <div className="flex items-center gap-1 bg-card border border-border-main rounded-lg p-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-text-secondary ml-1" />
              {(['ALL', 'SUCCESS', 'FAILED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-0.5 rounded text-xs font-bold transition-all ${
                    filterStatus === st
                      ? 'bg-[#00A3FF] text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-main'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-text-secondary" />
              <input
                type="text"
                placeholder="Search wallet, endpoint, error..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-card border border-border-main rounded-lg pl-8 pr-3 py-1 text-xs w-48 focus:outline-none focus:border-[#00A3FF]"
              />
            </div>

            <button
              onClick={loadLogs}
              title="Refresh API Logs"
              className="p-1.5 rounded-lg border border-border-main bg-card hover:bg-input text-text-secondary hover:text-text-main transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleClear}
              title="Clear API Logs"
              disabled={logs.length === 0}
              className="p-1.5 rounded-lg border border-border-main bg-card hover:bg-red-500/10 text-text-secondary hover:text-red-500 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table & Inspector Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border-main">
          {/* Logs Table (Left 2 cols) */}
          <div className="lg:col-span-2 overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-input text-text-secondary font-medium border-b border-border-main sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Endpoint / Method</th>
                  <th className="px-4 py-3">Connected Wallet</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                      <Shield className="w-8 h-8 mx-auto mb-2 text-text-secondary/50" />
                      <p className="font-semibold text-text-main">No API verification requests recorded</p>
                      <p className="text-xs text-text-secondary mt-1">
                        Connect a wallet or verify a signature to inspect real-time cryptographic payloads.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isSelected = selectedLog?.id === log.id;
                    const dateObj = new Date(log.timestamp);
                    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#00A3FF]/10' : 'hover:bg-input/40'
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                          <span className="block font-mono text-text-main">{timeStr}</span>
                          <span className="text-[10px] text-text-secondary">{dateStr}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-500 border border-red-500/20'
                            }`}
                          >
                            {log.status === 'SUCCESS' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            HTTP {log.httpStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 rounded bg-input text-[10px] font-bold text-text-secondary">
                              {log.method}
                            </span>
                            <span className="text-text-main font-semibold">{log.endpoint}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[#00A3FF]">
                          {log.wallet ? (
                            <span>{log.wallet.slice(0, 6)}...{log.wallet.slice(-4)}</span>
                          ) : (
                            <span className="text-text-secondary">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-text-secondary whitespace-nowrap">
                          {log.latencyMs}ms
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="px-2 py-1 bg-input hover:bg-input/80 text-text-main text-[11px] font-bold rounded transition-colors"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Detailed Request/Response Payload Inspector (Right col) */}
          <div className="p-5 bg-card/60 flex flex-col justify-between space-y-4 max-h-[600px] overflow-y-auto">
            {selectedLog ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border-main pb-3">
                  <div>
                    <h3 className="font-bold text-xs text-text-main flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-[#00A3FF]" />
                      Audit Request Inspector
                    </h3>
                    <span className="text-[10px] text-text-secondary font-mono">ID: {selectedLog.id}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedLog.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                    }`}
                  >
                    {selectedLog.status} • {selectedLog.httpStatus}
                  </span>
                </div>

                {/* Metadata tags */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-input/40 p-3 rounded-xl border border-border-main">
                  <div>
                    <span className="text-text-secondary block">Endpoint:</span>
                    <span className="font-mono font-bold text-text-main">{selectedLog.endpoint}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary block">Latency:</span>
                    <span className="font-mono font-bold text-text-main">{selectedLog.latencyMs} ms</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-border-main">
                    <span className="text-text-secondary block">Wallet:</span>
                    <span className="font-mono font-bold text-[#00A3FF] break-all">{selectedLog.wallet || 'N/A'}</span>
                  </div>
                </div>

                {/* Error message if any */}
                {selectedLog.errorMessage && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 space-y-1">
                    <span className="font-bold block flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Rejection / Error Message:
                    </span>
                    <p className="font-mono text-[11px] break-words">{selectedLog.errorMessage}</p>
                  </div>
                )}

                {/* Request Payload JSON */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-main">Request Payload</span>
                    {selectedLog.requestPayload && (
                      <button
                        onClick={() => copyText('req', JSON.stringify(selectedLog.requestPayload, null, 2))}
                        className="text-[10px] text-[#00A3FF] hover:underline flex items-center gap-1"
                      >
                        {copiedId === 'req' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    )}
                  </div>
                  <pre className="p-3 bg-input rounded-xl text-[10px] font-mono text-text-main overflow-x-auto max-h-40 border border-border-main whitespace-pre-wrap break-all">
                    {selectedLog.requestPayload ? JSON.stringify(selectedLog.requestPayload, null, 2) : 'No payload sent'}
                  </pre>
                </div>

                {/* Response Payload JSON */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-main">Response Payload</span>
                    {selectedLog.responsePayload && (
                      <button
                        onClick={() => copyText('res', JSON.stringify(selectedLog.responsePayload, null, 2))}
                        className="text-[10px] text-[#00A3FF] hover:underline flex items-center gap-1"
                      >
                        {copiedId === 'res' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    )}
                  </div>
                  <pre className="p-3 bg-input rounded-xl text-[10px] font-mono text-text-main overflow-x-auto max-h-40 border border-border-main whitespace-pre-wrap break-all">
                    {selectedLog.responsePayload ? JSON.stringify(selectedLog.responsePayload, null, 2) : 'No response payload recorded'}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-text-secondary space-y-2">
                <Code className="w-8 h-8 mx-auto text-text-secondary/40" />
                <p className="font-semibold text-xs text-text-main">No Request Selected</p>
                <p className="text-[11px]">Select any row in the table to inspect full cryptographic signature headers and payloads.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
