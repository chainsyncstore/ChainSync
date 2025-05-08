import React from 'react';

interface ChainSyncLogoProps {
  className?: string;
  textClassName?: string;
  withText?: boolean;
  textColor?: string;
  iconColor?: string;
}

export function ChainSyncLogo({
  className = "w-8 h-8",
  textClassName = "ml-2 text-xl font-bold",
  withText = true,
  textColor = "white",
  iconColor = "#0B4F82" // Dark blue color
}: ChainSyncLogoProps) {
  return (
    <div className="flex items-center">
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Interlinked chain symbol */}
        <path
          d="M7 8V7C7 5.34315 8.34315 4 10 4H14C15.6569 4 17 5.34315 17 7V8C18.6569 8 20 9.34315 20 11V13C20 14.6569 18.6569 16 17 16V17C17 18.6569 15.6569 20 14 20H10C8.34315 20 7 18.6569 7 17V16C5.34315 16 4 14.6569 4 13V11C4 9.34315 5.34315 8 7 8Z"
          fill={iconColor}
          fillOpacity="0.2"
          stroke={iconColor}
          strokeWidth="1.5"
        />
        
        {/* Shopping cart icon integrated with chain */}
        <path
          d="M9 11V11C9 10.4477 9.44772 10 10 10H14C14.5523 10 15 10.4477 15 11V14M15 17H10C9.44772 17 9 16.5523 9 16V14M15 17C15 18.1046 14.1046 19 13 19C11.8954 19 11 18.1046 11 17M9 14H7M15 14H16"
          stroke={iconColor}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      
      {withText && (
        <span className={textClassName} style={{ color: textColor }}>
          ChainSync
        </span>
      )}
    </div>
  );
}