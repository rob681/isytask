"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getRandomPhrase, getEndOfDayPhrase } from "@isytask/shared";
import { trpc } from "@/lib/trpc/client";
import { Sparkles, X, Sun } from "lucide-react";

interface BusinessHoursDay {
  enabled: boolean;
  blocks: Array<{ start: string; end: string }>;
}

type BusinessHours = Record<string, BusinessHoursDay>;

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Check if current time is within work hours */
function isWithinWorkHours(businessHours: BusinessHours): boolean {
  const now = new Date();
  const dayKey = DAY_KEYS[now.getDay()];
  const dayConf = businessHours[dayKey];
  if (!dayConf?.enabled) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return dayConf.blocks.some((block) => {
    const [startH, startM] = block.start.split(":").map(Number);
    const [endH, endM] = block.end.split(":").map(Number);
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    return currentMinutes >= start && currentMinutes <= end;
  });
}

/** Check if we're near the end of the last work block (within 15 min) */
function isNearEndOfDay(businessHours: BusinessHours): boolean {
  const now = new Date();
  const dayKey = DAY_KEYS[now.getDay()];
  const dayConf = businessHours[dayKey];
  if (!dayConf?.enabled || dayConf.blocks.length === 0) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const lastBlock = dayConf.blocks[dayConf.blocks.length - 1];
  const [endH, endM] = lastBlock.end.split(":").map(Number);
  const endMinutes = endH * 60 + endM;

  // Within 15 minutes of end of day
  return currentMinutes >= endMinutes - 15 && currentMinutes <= endMinutes;
}

/** Get next interval (random between 90-180 minutes = 1.5-3 hours) */
function getNextInterval(): number {
  const minMs = 90 * 60 * 1000; // 1.5 hours
  const maxMs = 180 * 60 * 1000; // 3 hours
  return minMs + Math.random() * (maxMs - minMs);
}

const STORAGE_KEY = "isytask_last_motivational";
const END_OF_DAY_KEY = "isytask_endofday_shown";

export function MotivationalToast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [isEndOfDay, setIsEndOfDay] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endOfDayCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: config } = trpc.config.getPublic.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const businessHours = config?.business_hours as BusinessHours | undefined;

  const showToast = useCallback(
    (msg: string, endDay = false) => {
      setMessage(msg);
      setIsEndOfDay(endDay);
      setVisible(true);

      // Save timestamp to avoid showing too frequently across page reloads
      localStorage.setItem(STORAGE_KEY, String(Date.now()));

      // Auto-dismiss after 6 seconds
      setTimeout(() => setVisible(false), 6000);
    },
    []
  );

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const interval = getNextInterval();
    timerRef.current = setTimeout(() => {
      if (!businessHours) return;

      if (isWithinWorkHours(businessHours)) {
        const phrase = getRandomPhrase("during");
        showToast(phrase);
      }

      // Schedule next
      scheduleNext();
    }, interval);
  }, [businessHours, showToast]);

  // Main scheduling effect
  useEffect(() => {
    if (!businessHours) return;

    // Check if we should delay based on last shown time
    const lastShown = localStorage.getItem(STORAGE_KEY);
    const elapsed = lastShown ? Date.now() - Number(lastShown) : Infinity;
    const minGap = 90 * 60 * 1000; // 1.5 hours minimum

    if (elapsed < minGap) {
      // Schedule for remaining time
      const remaining = minGap - elapsed;
      timerRef.current = setTimeout(() => {
        if (isWithinWorkHours(businessHours)) {
          showToast(getRandomPhrase("during"));
        }
        scheduleNext();
      }, remaining);
    } else if (isWithinWorkHours(businessHours)) {
      // Show first one after a short delay (30-60 seconds after page load)
      const initialDelay = 30000 + Math.random() * 30000;
      timerRef.current = setTimeout(() => {
        showToast(getRandomPhrase("during"));
        scheduleNext();
      }, initialDelay);
    } else {
      scheduleNext();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [businessHours, showToast, scheduleNext]);

  // End-of-day check (every 5 minutes)
  useEffect(() => {
    if (!businessHours) return;

    endOfDayCheckRef.current = setInterval(() => {
      const today = new Date().toDateString();
      const shownToday = localStorage.getItem(END_OF_DAY_KEY);

      if (shownToday === today) return; // Already shown today

      if (isNearEndOfDay(businessHours)) {
        const phrase = getEndOfDayPhrase();
        showToast(phrase, true);
        localStorage.setItem(END_OF_DAY_KEY, today);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => {
      if (endOfDayCheckRef.current) clearInterval(endOfDayCheckRef.current);
    };
  }, [businessHours, showToast]);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-sm animate-in slide-in-from-bottom-5 fade-in duration-500 ${
        !visible ? "animate-out slide-out-to-bottom-5 fade-out" : ""
      }`}
    >
      <div
        className={`relative flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm ${
          isEndOfDay
            ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30"
            : "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30"
        }`}
      >
        <div
          className={`flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${
            isEndOfDay ? "bg-amber-500/20" : "bg-primary/20"
          }`}
        >
          {isEndOfDay ? (
            <Sun className="h-4 w-4 text-amber-500" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              isEndOfDay ? "text-amber-700 dark:text-amber-300" : "text-foreground"
            }`}
          >
            {isEndOfDay ? "Fin de jornada" : "Isytask"}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
            {message}
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="flex-shrink-0 p-0.5 rounded-md hover:bg-muted/50 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
