import React from 'react';
import { Tooltip, TooltipProps } from '@mui/material';

interface Props {
  /** Why the control is disabled. Truthy => disabled + this tooltip shown. */
  reason?: string | null;
  /** Shown instead, while the control is enabled — optional, purely explanatory. */
  hint?: string;
  placement?: TooltipProps['placement'];
  /** Extra classes for the wrapping <span> — pass e.g. 'flex-1' when the child itself was flex-1,
      since the wrapper span sits between the child and its flex-row parent. */
  wrapperClassName?: string;
  children: React.ReactElement;
}

/**
 * MUI Tooltips don't fire hover events on a disabled child, so disabled controls need an extra
 * non-disabled wrapper to host the tooltip — this is that wrapper, generalising the one place in
 * this codebase that already did it right (the troop-type select list).
 */
export const DisabledHint: React.FC<Props> = ({ reason, hint, placement = 'left', wrapperClassName, children }) => (
  <Tooltip title={reason ?? hint ?? ''} placement={placement} arrow disableHoverListener={!reason && !hint}>
    <span className={`inline-flex ${wrapperClassName ?? ''}`}>{children}</span>
  </Tooltip>
);
