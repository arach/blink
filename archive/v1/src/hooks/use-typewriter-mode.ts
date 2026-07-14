import { useEffect, useRef } from 'react';
import { useConfigStore } from '../stores/config-store';

export function useTypewriterMode() {
  const { config } = useConfigStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isTypewriterMode = config?.appearance?.typewriterMode ?? false;

  useEffect(() => {
    if (!isTypewriterMode || !textareaRef.current) return;

    const textarea = textareaRef.current;
    
    const handleInput = () => {
      // Get current cursor position
      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = textarea.value.substring(0, cursorPosition);
      const lines = textBeforeCursor.split('\n');
      const currentLineNumber = lines.length;
      
      // Calculate line height
      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(computedStyle.lineHeight);
      const fontSize = parseFloat(computedStyle.fontSize);
      const actualLineHeight = lineHeight || fontSize * 1.5;
      
      // Calculate scroll position to center current line
      const currentLineTop = (currentLineNumber - 1) * actualLineHeight;
      const textareaHeight = textarea.clientHeight;
      const targetScrollTop = currentLineTop - (textareaHeight / 2) + (actualLineHeight / 2);
      
      // Smooth scroll to position
      textarea.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    };

    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('keydown', handleInput);
    textarea.addEventListener('click', handleInput);

    return () => {
      textarea.removeEventListener('input', handleInput);
      textarea.removeEventListener('keydown', handleInput);
      textarea.removeEventListener('click', handleInput);
    };
  }, [isTypewriterMode]);

  return textareaRef;
}