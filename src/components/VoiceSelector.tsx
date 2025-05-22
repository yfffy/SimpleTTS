"use client";

import React, { useMemo } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectGroup,
  SelectLabel
} from '@/components/ui/select';
import { VoiceInfo } from '@/types';

interface VoiceSelectorProps {
  voices: VoiceInfo[];
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
}

export default function VoiceSelector({ 
  voices, 
  selectedVoice, 
  onVoiceChange 
}: VoiceSelectorProps) {
  
  // Group voices by locale
  const groupedVoices = useMemo(() => {
    const groups: Record<string, VoiceInfo[]> = {};
    
    voices.forEach(voice => {
      const locale = voice.locale;
      if (!groups[locale]) {
        groups[locale] = [];
      }
      groups[locale].push(voice);
    });
    
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [voices]);

  if (voices.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">Loading voices...</div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Select Voice</label>
      <Select 
        value={selectedVoice} 
        onValueChange={onVoiceChange}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a voice" />
        </SelectTrigger>
        <SelectContent>
          {groupedVoices.map(([locale, localeVoices]) => (
            <SelectGroup key={locale}>
              <SelectLabel>{locale}</SelectLabel>
              {localeVoices.map(voice => (
                <SelectItem 
                  key={voice.name} 
                  value={voice.name}
                >
                  {voice.name} ({voice.gender})
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
} 