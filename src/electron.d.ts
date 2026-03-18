interface Window {
    electronAPI?: {
        isElectron: boolean;
        platform: string;
        minimize: () => void;
        maximize: () => void;
        close: () => void;
        setMinimizeToTray: (value: boolean) => void;
        notify: (title: string, body: string) => void;
    };
}