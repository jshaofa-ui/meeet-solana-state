import { useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle } from "lucide-react";

const Callback = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const success = !!code && !error;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {success ? (
          <>
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">LinkedIn Connected!</h1>
            <p className="text-muted-foreground">Your LinkedIn account has been successfully linked. You can now return to the Telegram bot.</p>
          </>
        ) : (
          <>
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Connection Failed</h1>
            <p className="text-muted-foreground">There was an error connecting your LinkedIn account. Please try again via <code className="text-primary">/linkedin</code> in the bot.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Callback;
