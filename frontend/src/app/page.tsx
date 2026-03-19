import HomeFeed from "@/components/HomeFeed";

export default function Home() {
  return (
    <div className="container">
      {/* Hero Section */}
      <section style={{ marginBottom: "80px" }}>
        <h1>
          Securing The Future <br />
          <span className="text-gradient">One Bit At A Time</span>
        </h1>
        <p className="subtitle">
          Join the exclusive community of security researchers and professionals.
          Discover zero-days, discuss threat models, and protect the decentralized web.
        </p>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button className="btn btn-primary">Start Exploring</button>
          <button className="btn btn-outline">Read the Docs</button>
        </div>
      </section>

      {/* Featured Section */}
      <section>
        <HomeFeed />
      </section>
    </div>
  );
}
