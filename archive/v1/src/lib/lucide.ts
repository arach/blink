import React from 'react';
import {
  Plus as PlusRaw,
  Search as SearchRaw,
  FileText as FileTextRaw,
  Trash2 as Trash2Raw,
  Palette as PaletteRaw,
  Eye as EyeRaw,
  Focus as FocusRaw,
  Keyboard as KeyboardRaw,
  Pin as PinRaw,
  Folder as FolderRaw,
  FolderOpen as FolderOpenRaw,
  Save as SaveRaw,
  Tag as TagRaw,
  EyeOff as EyeOffRaw,
  PinOff as PinOffRaw,
} from 'lucide-react';

// Normalize icon component types to this project's React types
export type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export const Plus: IconComponent = PlusRaw as unknown as IconComponent;
export const Search: IconComponent = SearchRaw as unknown as IconComponent;
export const FileText: IconComponent = FileTextRaw as unknown as IconComponent;
export const Trash2: IconComponent = Trash2Raw as unknown as IconComponent;
export const Palette: IconComponent = PaletteRaw as unknown as IconComponent;
export const Eye: IconComponent = EyeRaw as unknown as IconComponent;
export const Focus: IconComponent = FocusRaw as unknown as IconComponent;
export const Keyboard: IconComponent = KeyboardRaw as unknown as IconComponent;
export const Pin: IconComponent = PinRaw as unknown as IconComponent;
export const Folder: IconComponent = FolderRaw as unknown as IconComponent;
export const FolderOpen: IconComponent = FolderOpenRaw as unknown as IconComponent;
export const Save: IconComponent = SaveRaw as unknown as IconComponent;
export const Tag: IconComponent = TagRaw as unknown as IconComponent;
export const EyeOff: IconComponent = EyeOffRaw as unknown as IconComponent;
export const PinOff: IconComponent = PinOffRaw as unknown as IconComponent;
