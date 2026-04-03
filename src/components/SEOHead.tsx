import { Helmet } from "react-helmet-async";

export interface SEOHeadProps {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  type?: string;
  jsonLd?: Record<string, unknown>;
}

const BASE_URL = "https://meeet.world";
const DEFAULT_OG = `${BASE_URL}/og-image.png`;

const SEOHead = ({ title, description, path, ogImage, type = "website", jsonLd }: SEOHeadProps) => {
  const canonical = `${BASE_URL}${path}`;
  const image = ogImage || DEFAULT_OG;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@Meeetworld" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default SEOHead;
