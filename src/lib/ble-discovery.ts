import { BleManager, Characteristic, Device, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';

const SCAN_TIMEOUT_MS = 15_000;
const FIFTI_SERVICE_UUID = '0000FFF0-0000-1000-8000-00805F9B34FB';
const USER_ID_CHAR_UUID = '0000FFF1-0000-1000-8000-00805F9B34FB';

export type DiscoveryCallback = (userId: string) => void;
export type ErrorCallback = (error: string) => void;

export class BleDiscoveryService {
  private manager: BleManager | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private seenDevices = new Set<string>();

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const api = Platform.Version as number;
      if (api >= 31) {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ]);
        return Object.values(results).every(
          (r) => r === PermissionsAndroid.RESULTS.GRANTED,
        );
      } else {
        const r = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        return r === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true; // iOS handled via config plugin plist key + system dialog on first BleManager init
  }

  async startDiscovery(
    myUserId: string,
    onDiscovered: DiscoveryCallback,
    onError: ErrorCallback,
  ): Promise<void> {
    this.manager = new BleManager();

    // Wait for Bluetooth to be on
    const state = await this.manager.state();
    if (state !== State.PoweredOn) {
      onError('bluetooth_unavailable');
      this.stopDiscovery();
      return;
    }

    // 1. Advertise ourselves (peripheral role)
    await this.startAdvertising(myUserId);

    // 2. Scan for others (central role)
    this.startScanning(onDiscovered, onError);

    // 3. Auto-stop after timeout
    this.scanTimer = setTimeout(() => this.stopDiscovery(), SCAN_TIMEOUT_MS);
  }

  private async startAdvertising(myUserId: string): Promise<void> {
    if (!this.manager) return;
    await this.manager.addService(FIFTI_SERVICE_UUID, true);
    await this.manager.addCharacteristic(
      FIFTI_SERVICE_UUID,
      USER_ID_CHAR_UUID,
      { read: true, notify: false },
      { readable: true },
      btoa(myUserId), // Base64 encode
    );
    await this.manager.startAdvertising({
      localName: 'Fifti',
      serviceUUIDs: [FIFTI_SERVICE_UUID],
    });
  }

  private startScanning(onDiscovered: DiscoveryCallback, onError: ErrorCallback): void {
    this.manager?.startDeviceScan(
      [FIFTI_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          onError('scan_error');
          return;
        }
        if (!device || this.seenDevices.has(device.id)) return;
        this.seenDevices.add(device.id);
        this.readUserIdFromDevice(device, onDiscovered);
      },
    );
  }

  private async readUserIdFromDevice(device: Device, onDiscovered: DiscoveryCallback) {
    try {
      const connected = await device.connect({ timeout: 5000 });
      await connected.discoverAllServicesAndCharacteristics();
      const char: Characteristic = await connected.readCharacteristicForService(
        FIFTI_SERVICE_UUID,
        USER_ID_CHAR_UUID,
      );
      if (char.value) {
        const userId = atob(char.value);
        if (userId && userId.length === 36) onDiscovered(userId);
      }
      await connected.cancelConnection();
    } catch {
      // Device went out of range or rejected — silently ignore
    }
  }

  stopDiscovery(): void {
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.seenDevices.clear();
    if (this.manager) {
      this.manager.stopDeviceScan();
      this.manager.stopAdvertising?.();
      this.manager.destroy();
      this.manager = null;
    }
  }
}

export const bleDiscoveryService = new BleDiscoveryService();
