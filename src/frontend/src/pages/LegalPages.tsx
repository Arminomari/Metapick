export function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fafafa', padding: '3rem 2rem', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Terms of Service — <span style={{ color: '#e84393' }}>ClipReach</span>
      </h1>
      <p style={{ color: '#8b8ba3', lineHeight: 1.8 }}>
        By using ClipReach, you agree to these terms. ClipReach connects brands with TikTok creators
        for campaign-based collaborations. Users must be at least 18 years old. We reserve the right
        to suspend accounts that violate our policies. All campaign payouts are subject to verification
        of views and engagement metrics. For questions, contact us at support@clipreach.org.
      </p>
      <p style={{ color: '#555', marginTop: '2rem', fontSize: '.875rem' }}>Last updated: April 2026</p>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fafafa', padding: '3rem 2rem', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Privacy Policy — <span style={{ color: '#e84393' }}>ClipReach</span>
      </h1>
      <p style={{ color: '#8b8ba3', lineHeight: 1.8 }}>
        ClipReach collects your email, name, and TikTok profile information (username, follower count,
        video metrics) to facilitate campaign management and payout calculations. We use TikTok's API
        to access your public video data and engagement statistics with your explicit consent via OAuth.
        We do not sell your personal data. You can disconnect your TikTok account and request data
        deletion at any time from your profile settings. For questions, contact us at privacy@clipreach.org.
      </p>
      <p style={{ color: '#555', marginTop: '2rem', fontSize: '.875rem' }}>Last updated: April 2026</p>
    </div>
  );
}
