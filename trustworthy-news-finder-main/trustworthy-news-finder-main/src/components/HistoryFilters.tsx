import { useState } from 'react';
import { Search, Filter, X, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface HistoryFiltersState {
  search: string;
  rating: string;
  scoreRange: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

interface HistoryFiltersProps {
  filters: HistoryFiltersState;
  onFiltersChange: (filters: HistoryFiltersState) => void;
}

export function HistoryFilters({ filters, onFiltersChange }: HistoryFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = <K extends keyof HistoryFiltersState>(
    key: K,
    value: HistoryFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      rating: 'all',
      scoreRange: 'all',
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.rating !== 'all' ||
    filters.scoreRange !== 'all' ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className="space-y-4 mb-6">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or URL..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(hasActiveFilters && 'border-primary text-primary')}
        >
          <Filter className="w-4 h-4" />
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-secondary/30 rounded-lg border border-border/50">
          {/* Rating Filter */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Rating</label>
            <Select
              value={filters.rating}
              onValueChange={(value) => updateFilter('rating', value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All ratings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                <SelectItem value="reliable">Reliable</SelectItem>
                <SelectItem value="verify">Verify</SelectItem>
                <SelectItem value="suspicious">Suspicious</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Score Range Filter */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Score Range</label>
            <Select
              value={filters.scoreRange}
              onValueChange={(value) => updateFilter('scoreRange', value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All scores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All scores</SelectItem>
                <SelectItem value="high">High (70-100)</SelectItem>
                <SelectItem value="medium">Medium (40-69)</SelectItem>
                <SelectItem value="low">Low (0-39)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full h-9 justify-start text-left font-normal',
                    !filters.dateFrom && 'text-muted-foreground'
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? format(filters.dateFrom, 'PP') : 'Pick date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(date) => updateFilter('dateFrom', date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full h-9 justify-start text-left font-normal',
                    !filters.dateTo && 'text-muted-foreground'
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {filters.dateTo ? format(filters.dateTo, 'PP') : 'Pick date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(date) => updateFilter('dateTo', date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </div>
  );
}
