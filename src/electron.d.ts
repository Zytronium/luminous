interface Window {
    electronAPI?: {
        isElectron: boolean;
        platform: string;
        minimize: () => void;
        maximize: () => void;
        close: () => void;
        setMinimizeToTray: (value: boolean) => void;
        notify: (title: string, body: string, channelId: string, messageId: string) => void;
        onNotificationClick: (callback: (channelId: string, messageId: string) => void) => void;
    };
}