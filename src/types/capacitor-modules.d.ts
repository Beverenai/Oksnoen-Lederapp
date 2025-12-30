/**
 * Type declarations for Capacitor plugins
 * These modules are dynamically imported and only available in native context
 * The actual packages will be installed when setting up Capacitor locally
 */

declare module '@capacitor/push-notifications' {
  export interface PushNotificationToken {
    value: string;
  }

  export interface PushNotificationActionPerformed {
    actionId: string;
    inputValue?: string;
    notification: any;
  }

  export interface PushNotificationSchema {
    title?: string;
    subtitle?: string;
    body?: string;
    id: string;
    badge?: number;
    data: any;
  }

  export interface PermissionStatus {
    receive: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
  }

  export const PushNotifications: {
    requestPermissions(): Promise<PermissionStatus>;
    register(): Promise<void>;
    addListener(
      eventName: 'registration',
      listenerFunc: (token: PushNotificationToken) => void
    ): Promise<any>;
    addListener(
      eventName: 'registrationError',
      listenerFunc: (error: any) => void
    ): Promise<any>;
    addListener(
      eventName: 'pushNotificationReceived',
      listenerFunc: (notification: PushNotificationSchema) => void
    ): Promise<any>;
    addListener(
      eventName: 'pushNotificationActionPerformed',
      listenerFunc: (notification: PushNotificationActionPerformed) => void
    ): Promise<any>;
    removeAllListeners(): Promise<void>;
  };
}

declare module '@capacitor/camera' {
  export enum CameraResultType {
    Uri = 'uri',
    Base64 = 'base64',
    DataUrl = 'dataUrl',
  }

  export enum CameraSource {
    Prompt = 'PROMPT',
    Camera = 'CAMERA',
    Photos = 'PHOTOS',
  }

  export interface Photo {
    base64String?: string;
    dataUrl?: string;
    path?: string;
    webPath?: string;
    exif?: any;
    format: string;
    saved: boolean;
  }

  export interface ImageOptions {
    quality?: number;
    allowEditing?: boolean;
    resultType: CameraResultType;
    source?: CameraSource;
    width?: number;
    height?: number;
    correctOrientation?: boolean;
  }

  export const Camera: {
    getPhoto(options: ImageOptions): Promise<Photo>;
  };
}

declare module '@capacitor/haptics' {
  export enum ImpactStyle {
    Heavy = 'HEAVY',
    Medium = 'MEDIUM',
    Light = 'LIGHT',
  }

  export enum NotificationType {
    Success = 'SUCCESS',
    Warning = 'WARNING',
    Error = 'ERROR',
  }

  export interface ImpactOptions {
    style: ImpactStyle;
  }

  export interface NotificationOptions {
    type: NotificationType;
  }

  export interface VibrateOptions {
    duration: number;
  }

  export const Haptics: {
    impact(options: ImpactOptions): Promise<void>;
    notification(options: NotificationOptions): Promise<void>;
    vibrate(options?: VibrateOptions): Promise<void>;
    selectionStart(): Promise<void>;
    selectionChanged(): Promise<void>;
    selectionEnd(): Promise<void>;
  };
}
