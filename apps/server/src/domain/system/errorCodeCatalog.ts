import { bidKingErrorCodeForMessage } from '@bitkingdom/bidking-compat';

export interface ApiErrorEnvelope {
  error: string;
  errorCodeId: string;
  errorCode: string;
  messageKey: string;
  errorName: string;
}

export function apiErrorEnvelope(message: string): ApiErrorEnvelope {
  const errorCode = bidKingErrorCodeForMessage(message);
  return {
    error: message,
    errorCodeId: errorCode.id,
    errorCode: errorCode.code,
    messageKey: errorCode.messageKey,
    errorName: errorCode.name
  };
}
