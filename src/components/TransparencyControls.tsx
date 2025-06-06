import { Slider } from './ui/Slider';
import { Button } from './ui/Button';
import { useWindowTransparency } from '../hooks/use-window-transparency';
import { Eye, EyeOff, Pin, PinOff } from 'lucide-react';

export const TransparencyControls = () => {
  const { opacity, isTransparent, alwaysOnTop, updateOpacity, toggleAlwaysOnTop } = useWindowTransparency();

  const handleOpacityChange = (value: number[]) => {
    updateOpacity(value[0]);
  };

  const handleAlwaysOnTopToggle = async () => {
    await toggleAlwaysOnTop();
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
      <div className="flex items-center gap-2">
        {isTransparent ? (
          <EyeOff className="h-4 w-4 text-gray-600" />
        ) : (
          <Eye className="h-4 w-4 text-gray-600" />
        )}
        <span className="text-sm font-medium text-gray-700">Opacity:</span>
      </div>
      
      <div className="flex-1 max-w-32">
        <Slider
          value={[opacity]}
          onValueChange={handleOpacityChange}
          max={1}
          min={0.1}
          step={0.1}
          className="w-full"
        />
      </div>
      
      <span className="text-sm text-gray-600 min-w-[3rem]">
        {Math.round(opacity * 100)}%
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={handleAlwaysOnTopToggle}
        className="flex items-center gap-2"
      >
        {alwaysOnTop ? (
          <>
            <PinOff className="h-4 w-4" />
            Unpin
          </>
        ) : (
          <>
            <Pin className="h-4 w-4" />
            Pin
          </>
        )}
      </Button>
    </div>
  );
};