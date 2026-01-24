export class CreateDeviceData {
  userId: number;
  fcmToken: string;
  platform: 'web' | 'android' | 'ios';
  enabled?: boolean;
}

export class UpdateDeviceData {
  fcmToken?: string;
  platform?: 'web' | 'android' | 'ios';
  enabled?: boolean;
}

