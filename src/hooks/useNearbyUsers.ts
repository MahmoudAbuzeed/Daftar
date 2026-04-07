import { useState, useCallback, useRef, useEffect } from 'react';
import { User } from '../types/database';
import { supabase } from '../lib/supabase';
import { bleDiscoveryService } from '../lib/ble-discovery';

export function useNearbyUsers() {
  const [nearbyUsers, setNearbyUsers] = useState<User[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => () => {
    bleDiscoveryService.stopDiscovery();
  }, []);

  const resolveUser = useCallback(async (userId: string) => {
    if (seenIds.current.has(userId)) return;
    seenIds.current.add(userId);
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) {
        setNearbyUsers((prev) =>
          prev.some((u) => u.id === userId) ? prev : [...prev, data as User]
        );
      }
    } catch {
      // Non-fatal: device may have gone offline
    }
  }, []);

  const startScan = useCallback(
    async (myUserId: string) => {
      setError(null);
      setNearbyUsers([]);
      seenIds.current.clear();
      setIsScanning(true);

      const ok = await bleDiscoveryService.requestPermissions();
      if (!ok) {
        setError('bluetooth_permission_denied');
        setIsScanning(false);
        return;
      }

      await bleDiscoveryService.startDiscovery(
        myUserId,
        (userId) => resolveUser(userId),
        (err) => {
          setError(err);
          setIsScanning(false);
        },
      );

      setTimeout(() => setIsScanning(false), 15_000);
    },
    [resolveUser]
  );

  const stopScan = useCallback(() => {
    bleDiscoveryService.stopDiscovery();
    setIsScanning(false);
  }, []);

  return { nearbyUsers, isScanning, error, startScan, stopScan };
}
