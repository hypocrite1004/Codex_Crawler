declare module 'react-quill-new' {
    import * as React from 'react';

    export interface ReactQuillProps {
        theme?: string;
        value?: string;
        onChange?: (value: string) => void;
        style?: React.CSSProperties;
        placeholder?: string;
        className?: string;
    }

    const ReactQuill: React.ComponentType<ReactQuillProps>;
    export default ReactQuill;
}
