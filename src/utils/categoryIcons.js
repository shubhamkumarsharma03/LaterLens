import {
  ShoppingBag,
  BookOpen,
  Lightbulb,
  MapPin,
  Calendar,
  User,
  Receipt,
  Ticket,
  Code,
  Folder,
  Sparkles,
  Search,
  ScanEye,
  ChevronDown,
  LayoutGrid,
  List,
  Clock,
  CheckCircle2,
  Share2,
  Trash2,
  FolderOutput,
  PlusCircle,
} from 'lucide-react-native';

export const CATEGORY_ICONS = {
  Shopping: ShoppingBag,
  Product: ShoppingBag,
  Study: BookOpen,
  'Study material': BookOpen,
  'Project idea': Lightbulb,
  Idea: Lightbulb,
  Place: MapPin,
  Event: Calendar,
  Person: User,
  Receipt: Receipt,
  Ticket: Ticket,
  Code: Code,
  default: Folder,
};

export const UI_ICONS = {
  Search,
  OCR: ScanEye,
  Sort: ChevronDown,
  Grid: LayoutGrid,
  List: List,
  Recent: Clock,
  Smart: Sparkles,
  Complete: CheckCircle2,
  Share: Share2,
  Delete: Trash2,
  Move: FolderOutput,
  Add: PlusCircle,
};

export function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS.default;
}
