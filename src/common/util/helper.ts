export const validateWebsiteUrl = (url: string): boolean => {
  const pattern: RegExp = /^(https:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-._~:/?#[\]@!$&'()*+,;=]*)?$/;
  return pattern.test(url);
}

export const formatDate = (date: Date, output: 'date' | 'time'): string => {
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  };

  if (output === 'date') {
    options.year = 'numeric';
    options.month = 'long';
    options.day = 'numeric';
  }

  return new Intl.DateTimeFormat('en-US', options).format(date);
};
