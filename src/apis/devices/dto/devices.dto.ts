export class RegisterDeviceDto {
  fcmToken: string;
  platform: 'web' | 'android' | 'ios';
}

