import React, { useEffect } from 'react';
import { toast, ToastContainer } from "react-toastify";
import { PageDataProvider } from "./hooks/usePageData";
import { SSRProvider } from "./hooks/useSSR";
import IndexPage from "./IndexPage";
import "./globals.scss";

interface AppProps {
  initialData: any;
}

// eslint-disable-next-line prefer-arrow-callback
export default function App({ initialData }: AppProps) {
  useEffect(() => {
    if(initialData._error) {
      toast.error(initialData._error.message);
    }
  }, [initialData._error]);
  
  return (
    <SSRProvider>
      <PageDataProvider initialData={initialData}>
        <IndexPage />
        <ToastContainer position="bottom-right" newestOnTop />
      </PageDataProvider>
    </SSRProvider>
  );
}
