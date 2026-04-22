'use client';

import { Search } from 'lucide-react';

import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';

export function SearchInput(props: {
  value: string;
  placeholder?: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  const { value, placeholder = '搜索', onValueChange, className } = props;
  return (
    <InputGroup className={className}>
      <InputGroupInput
        placeholder={placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        aria-label={placeholder}
      />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
    </InputGroup>
  );
}
