import React from 'react';

interface TimePicker12hProps {
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
  onChange: (time: { hour: string; minute: string; period: 'AM' | 'PM' }) => void;
  className?: string;
}

const HOURS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export const TimePicker12h: React.FC<TimePicker12hProps> = ({
  hour,
  minute,
  period,
  onChange,
  className = '',
}) => {
  const normalizedHour = (hour || '12').padStart(2, '0');
  const normalizedMinute = (minute || '00').padStart(2, '0');

  return (
    <div className={`flex items-center gap-1 bg-white border border-gray-300 rounded-xl px-2 py-1 shadow-sm ${className}`}>
      <select
        aria-label="Hour"
        className="bg-transparent text-sm font-bold text-gray-800 focus:outline-none cursor-pointer py-1"
        value={normalizedHour}
        onChange={(e) => onChange({ hour: e.target.value, minute: normalizedMinute, period })}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="font-bold text-gray-400 text-sm" aria-hidden="true">:</span>
      <select
        aria-label="Minute"
        className="bg-transparent text-sm font-bold text-gray-800 focus:outline-none cursor-pointer py-1"
        value={normalizedMinute}
        onChange={(e) => onChange({ hour: normalizedHour, minute: e.target.value, period })}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label="AM or PM"
        className="bg-primary-50 text-primary-700 font-extrabold text-xs px-2 py-1 rounded-lg focus:outline-none cursor-pointer ml-1"
        value={period}
        onChange={(e) => onChange({ hour: normalizedHour, minute: normalizedMinute, period: e.target.value as 'AM' | 'PM' })}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export default TimePicker12h;
