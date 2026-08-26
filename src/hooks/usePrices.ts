import { useState, useEffect, useCallback, useRef } from "react";
import { TOKENS } from "../lib/tokens";
import { Token } from "../types";

interface PriceData {
  [key: string]: {
    usd: number;
    usd_24h_change?: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
  };
}

export interface LidoLiveMetrics {
  apr: number;
  totalPooledEther: number;
  stakerCount: number;
  marketCapUsd: number;
  lastUpdated: number;
}

export function useLivePrices() {
  const [prices, setPrices] = useState<PriceData>({});
  const [lidoMetrics, setLidoMetrics] = useState<LidoLiveMetrics>({
    apr: 3.15,
    totalPooledEther: 9850000,
    stakerCount: 654200,
    marketCapUsd: 26500000000,
    lastUpdated: Date.now(),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const ids = TOKENS.map((t) => t.id).join(",");

  const fetchPricesAndMetrics = useCallback(async () => {
    try {
      const [priceRes, lidoAprRes] = await Promise.allSettled([
        fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
          { cache: "no-store" }
        ),
        fetch('https://eth-api.lido.fi/v1/protocol/steth/apr/last', { cache: 'no-store' }),
      ]);

      if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
        const data: PriceData = await priceRes.value.json();
        setPrices(data);
        setError(null);

        if (data['staked-ether']?.usd_market_cap) {
          setLidoMetrics((prev) => ({
            ...prev,
            marketCapUsd: data['staked-ether'].usd_market_cap || prev.marketCapUsd,
          }));
        }
      }

      if (lidoAprRes.status === 'fulfilled' && lidoAprRes.value.ok) {
        const aprData = await lidoAprRes.value.json();
        if (aprData?.data?.apr) {
          const rawApr = parseFloat(aprData.data.apr);
          if (!isNaN(rawApr) && rawApr > 0) {
            setLidoMetrics((prev) => ({
              ...prev,
              apr: Number(rawApr.toFixed(2)),
              lastUpdated: Date.now(),
            }));
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [ids]);

  useEffect(() => {
    fetchPricesAndMetrics();
    intervalRef.current = setInterval(fetchPricesAndMetrics, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPricesAndMetrics]);

  const getPrice = useCallback((tokenId: string) => prices[tokenId]?.usd ?? 0, [prices]);
  const getChange = useCallback((tokenId: string) => prices[tokenId]?.usd_24h_change ?? 0, [prices]);
  const getMarketCap = useCallback((tokenId: string) => prices[tokenId]?.usd_market_cap ?? 0, [prices]);
  const getVolume = useCallback((tokenId: string) => prices[tokenId]?.usd_24h_vol ?? 0, [prices]);

  const enrichToken = useCallback(
    (token: Token): Token => ({
      ...token,
      price: getPrice(token.id),
      priceChange24h: getChange(token.id),
      marketCap: getMarketCap(token.id),
      volume24h: getVolume(token.id),
    }),
    [getPrice, getChange, getMarketCap, getVolume]
  );

  return { prices, lidoMetrics, loading, error, getPrice, getChange, enrichToken };
}

