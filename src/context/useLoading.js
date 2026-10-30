import { createContext, useContext } from 'react';

export const LoadingContext = createContext(null);

export const useLoading = () => useContext(LoadingContext);
