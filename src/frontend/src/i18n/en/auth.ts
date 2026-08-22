/**
 * English translations for the auth flow (login, signup wizard, password
 * reset, TikTok OAuth pages, social buttons, image picker).
 * Swedish-string-as-key; a missing key falls back to the Swedish source.
 */
export const auth: Record<string, string> = {
  // ── AuthShell brand panel ──────────────────────────
  'KREATÖRER × VARUMÄRKEN': 'CREATORS × BRANDS',
  'Där kreatörer och varumärken faktiskt': 'Where creators and brands actually',
  'möts': 'meet',
  'VYRLE matchar rätt kreatörer med rätt kampanjer, och betalar ut i samma stund som jobbet presterar.':
    'VYRLE matches the right creators with the right campaigns, and pays out the moment the work performs.',
  'Briefs matchade mot din publik, inte ditt följarantal': 'Briefs matched to your audience, not your follower count',
  'Transparent ersättning innan du postar': 'Transparent pay before you post',
  'Direkta utbetalningar, inga mellanhänder': 'Direct payouts, no middlemen',
  'Byggt för kreatörer och varumärken i Norden.': 'Built for creators and brands in the Nordics.',

  // ── API errors ─────────────────────────────────────
  'Kunde inte nå servern. Försök igen om en stund.': 'Could not reach the server. Please try again in a moment.',
  'För många försök. Vänta en minut och försök igen.': 'Too many attempts. Wait a minute and try again.',
  'Inloggningen misslyckades — försök igen': 'Sign-in failed — please try again',
  'Fel e-post eller lösenord': 'Wrong email or password',
  'Registreringen misslyckades. Försök igen.': 'Registration failed. Please try again.',

  // ── Login ──────────────────────────────────────────
  'Logga': 'Log',
  'in': 'in',
  'Fortsätt där du slutade.': 'Pick up where you left off.',
  'E-post': 'Email',
  'du@exempel.se': 'you@example.com',
  'Lösenord': 'Password',
  'Glömt lösenordet?': 'Forgot your password?',
  'Loggar in…': 'Signing in…',
  'Logga in': 'Log in',
  'Inget konto?': 'No account?',
  'Skapa konto': 'Create account',

  // ── Signup wizard shell ────────────────────────────
  'Skapa': 'Create',
  'konto': 'account',
  'Vem är du? Vi anpassar resten efter ditt svar.': 'Who are you? We tailor the rest to your answer.',
  'Vi granskar och godkänner din profil innan du går live, oftast inom 1–2 arbetsdagar.':
    'We review and approve your profile before you go live, usually within 1–2 business days.',
  'Registreringssteg': 'Registration steps',
  'Steg': 'Step',
  'av': 'of',
  'Kontotyp': 'Account type',
  'Konto': 'Account',
  'Profil': 'Profile',
  'Räckvidd': 'Reach',
  'Expertis': 'Expertise',
  'Företag': 'Company',
  'Kontakt': 'Contact',

  // ── Step: role ─────────────────────────────────────
  'Jag är kreatör': 'I am a creator',
  'Hitta betalda kampanjer, visa upp ditt innehåll och få betalt per visning.':
    'Find paid campaigns, showcase your content and get paid per view.',
  'Jag är varumärke': 'I am a brand',
  'Skapa kampanjer, hitta rätt kreatörer och betala bara för verifierade visningar.':
    'Create campaigns, find the right creators and pay only for verified views.',

  // ── Step: account ──────────────────────────────────
  'Inloggad via': 'Signed in via',
  'som': 'as',
  '— inget lösenord behövs.': '— no password needed.',
  'Använd e-post i stället': 'Use email instead',
  'Minst 8 tecken': 'At least 8 characters',
  'Versal (A–Z)': 'Uppercase (A–Z)',
  'Gemen (a–z)': 'Lowercase (a–z)',
  'Siffra (0–9)': 'Number (0–9)',
  'Förnamn (kontaktperson)': 'First name (contact person)',
  'Förnamn': 'First name',
  'Efternamn': 'Last name',

  // ── Validation ─────────────────────────────────────
  'Ange en giltig e-postadress': 'Enter a valid email address',
  'Lösenordet uppfyller inte alla krav': 'The password does not meet all the requirements',
  'Visningsnamn krävs': 'Display name is required',
  'Skriv minst 20 tecken i din bio — varumärken läser den först av allt':
    'Write at least 20 characters in your bio — brands read it before anything else',
  'TikTok-användarnamn krävs': 'TikTok username is required',
  'Välj minst en expertis-tagg': 'Select at least one expertise tag',
  'Företagsnamn krävs': 'Company name is required',
  'Ange organisationsnummer i formatet XXXXXX-XXXX': 'Enter the organization number in the format XXXXXX-XXXX',

  // ── Step: profile ──────────────────────────────────
  'Profilbild': 'Profile picture',
  'Varumärken ser den först — ett tydligt ansikte ökar dina chanser.':
    'Brands see it first — a clear face improves your chances.',
  'Visningsnamn': 'Display name',
  'Ditt namn eller alias': 'Your name or alias',
  'Bio': 'Bio',
  'Berätta om dig och ditt innehåll — varför ska varumärken samarbeta med dig?':
    'Tell us about yourself and your content — why should brands work with you?',
  'tecken minimum': 'characters minimum',
  'Kategori': 'Category',
  'Land': 'Country',
  'Födelsedatum': 'Date of birth',

  // ── Step: reach ────────────────────────────────────
  'TikTok-användarnamn': 'TikTok username',
  'dittanvändarnamn': 'yourusername',
  'Efter godkännande kopplar du kontot via TikTok för automatisk visningsverifiering.':
    'Once approved, you connect the account via TikTok for automatic view verification.',
  'Följare på TikTok': 'Followers on TikTok',
  't.ex. 12000': 'e.g. 12000',
  'Snittvisningar per video': 'Average views per video',
  't.ex. 8500': 'e.g. 8500',
  'Instagram-användarnamn': 'Instagram username',
  'dittinstagram': 'yourinstagram',
  'Följare på Instagram': 'Followers on Instagram',
  't.ex. 4300': 'e.g. 4300',
  'Webbplats / Linktree': 'Website / Linktree',

  // ── Step: expertise ────────────────────────────────
  'Expertis-taggar * — vad är du bra på?': 'Expertise tags * — what are you good at?',
  'Välj minst en tagg': 'Select at least one tag',
  'Valt:': 'Selected:',
  'tagg(ar)': 'tag(s)',
  'Öppen för direkta PR-erbjudanden från varumärken': 'Open to direct PR offers from brands',

  // ── Step: company ──────────────────────────────────
  'Logotyp': 'Logo',
  'Visas för kreatörer på era kampanjer.': 'Shown to creators on your campaigns.',
  'Företagsnamn': 'Company name',
  'Organisationsnummer': 'Organization number',
  'Bransch': 'Industry',
  'Webbplats': 'Website',
  'https://erforetag.se': 'https://yourcompany.com',

  // ── Step: contact ──────────────────────────────────
  'Kontakttelefon': 'Contact phone',
  'Om företaget': 'About the company',
  'Vad gör ni, och vilken typ av kreatörer letar ni efter? Kreatörer ser detta på era kampanjer.':
    'What do you do, and what kind of creators are you looking for? Creators see this on your campaigns.',

  // ── Wizard nav / consent ───────────────────────────
  'Tillbaka': 'Back',
  'Skicka ansökan': 'Submit application',
  'Fortsätt': 'Continue',
  'Genom att skicka in godkänner du våra': 'By submitting you agree to our',
  'villkor': 'terms',
  'och vår': 'and our',
  'integritetspolicy': 'privacy policy',
  'Kontot granskas av en administratör innan du kan logga in.':
    'Your account is reviewed by an administrator before you can log in.',
  'Har redan konto?': 'Already have an account?',

  // ── Summary ────────────────────────────────────────
  'Org.nr': 'Org. no.',
  'Ej angiven': 'Not specified',
  'Sammanfattning': 'Summary',

  // ── Pending approval ───────────────────────────────
  'Ansökan': 'Application',
  'mottagen': 'received',
  'Tack för att du går med i VYRLE. Vi granskar din profil nu och hör av oss så snart du är godkänd, oftast inom 1 till 2 arbetsdagar.':
    'Thanks for joining VYRLE. We are reviewing your profile now and will get back to you as soon as you are approved, usually within 1 to 2 business days.',
  'Du får ett meddelande när ditt konto har godkänts.': 'You will get a message when your account has been approved.',
  'Tillbaka till startsidan': 'Back to the start page',

  // ── Password visibility ────────────────────────────
  'Dölj lösenord': 'Hide password',
  'Visa lösenord': 'Show password',

  // ── Forgot password ────────────────────────────────
  'Glömt': 'Forgot your',
  'lösenordet?': 'password?',
  'Om': 'If',
  'finns hos oss har vi skickat en återställningslänk. Kolla inkorgen — och skräpposten för säkerhets skull.':
    'is registered with us, we have sent a reset link. Check your inbox — and the spam folder just in case.',
  'Ange din e-post så skickar vi en länk för att välja ett nytt lösenord.':
    'Enter your email and we will send you a link to choose a new password.',
  'Något gick fel. Försök igen om en stund.': 'Something went wrong. Please try again in a moment.',
  'Skicka återställningslänk': 'Send reset link',
  'Tillbaka till inloggning': 'Back to sign-in',

  // ── Reset password ─────────────────────────────────
  'Länken är ogiltig eller har gått ut. Begär en ny.': 'The link is invalid or has expired. Request a new one.',
  'Ogiltig': 'Invalid',
  'länk': 'link',
  'Återställningslänken saknas eller är trasig.': 'The reset link is missing or broken.',
  'Begär en ny länk': 'Request a new link',
  'Välj nytt': 'Choose a new',
  'lösenord': 'password',
  'Klart! Ditt lösenord är uppdaterat.': 'Done! Your password has been updated.',
  'Nytt lösenord': 'New password',
  'Minst 8 tecken, versal + siffra': 'At least 8 characters, uppercase + number',
  'Sparar…': 'Saving…',
  'Spara nytt lösenord': 'Save new password',

  // ── TikTok callback page ───────────────────────────
  'TikTok nekade åtkomst:': 'TikTok denied access:',
  'Ingen auktoriseringskod mottogs från TikTok.': 'No authorization code was received from TikTok.',
  'Kunde inte ansluta TikTok-kontot.': 'Could not connect the TikTok account.',
  'Anslutning misslyckades': 'Connection failed',
  'Tillbaka till profil': 'Back to profile',
  'TikTok anslutet!': 'TikTok connected!',
  'Omdirigerar till din profil...': 'Redirecting to your profile...',
  'Ansluter TikTok...': 'Connecting TikTok...',
  'Vänta medan vi kopplar ditt konto.': 'Please wait while we link your account.',

  // ── TikTok sign-in page ────────────────────────────
  'Inloggningen avbröts.': 'The sign-in was cancelled.',
  'Något gick fel. Försök igen.': 'Something went wrong. Please try again.',
  'Kunde inte logga in med TikTok. Försök igen.': 'Could not sign in with TikTok. Please try again.',
  'Hoppsan': 'Oops',
  'Till inloggningen': 'Go to sign-in',
  'Loggar in med TikTok…': 'Signing in with TikTok…',

  // ── Social buttons ─────────────────────────────────
  'Kunde inte starta TikTok-inloggning — försök igen': 'Could not start TikTok sign-in — please try again',
  'eller fortsätt med': 'or continue with',
  'Öppnar…': 'Opening…',
  'Fortsätt med TikTok': 'Continue with TikTok',
  'Fortsätt med Google': 'Continue with Google',
  'Fortsätt med Apple': 'Continue with Apple',
  'Fortsätt med Facebook': 'Continue with Facebook',

  // ── Image picker ───────────────────────────────────
  'Välj en bildfil (JPG, PNG eller WebP)': 'Choose an image file (JPG, PNG or WebP)',
  'Bilden är för stor (max 12 MB)': 'The image is too large (max 12 MB)',
  'Bilden kunde inte läsas — prova en annan fil': 'The image could not be read — try another file',
  'Bearbetar…': 'Processing…',
  'Byt bild': 'Change image',
  'Ladda upp bild': 'Upload image',
  'Klicka eller släpp en bild här · JPG, PNG, WebP': 'Click or drop an image here · JPG, PNG, WebP',
  'Ta bort bild': 'Remove image',

  // ── Categories (display labels; values stay Swedish) ─
  'Övrigt': 'Other',
  'Mode': 'Fashion',
  'Skönhet': 'Beauty',
  'Mat': 'Food',
  'Teknik': 'Tech',
  'Sport': 'Sports',
  'Musik': 'Music',
  'Resor': 'Travel',
  'Livsstil': 'Lifestyle',

  // ── Industries (display labels) ────────────────────
  'Mode & Kläder': 'Fashion & Clothing',
  'Skönhet & Hudvård': 'Beauty & Skincare',
  'Mat & Dryck': 'Food & Drink',
  'Teknik & Appar': 'Tech & Apps',
  'Sport & Hälsa': 'Sports & Health',
  'Inredning & Hem': 'Interior & Home',
  'Finans': 'Finance',
  'Utbildning': 'Education',
  'Underhållning': 'Entertainment',

  // ── Countries (display labels) ─────────────────────
  'Sverige': 'Sweden',
  'Norge': 'Norway',
  'Danmark': 'Denmark',

  // ── Niche tags (display labels; values stay Swedish) ─
  'Hudvård': 'Skincare',
  'Hår & Skönhet': 'Hair & Beauty',
  'Smycken & Accessoarer': 'Jewelry & Accessories',
  'Hälsa & Wellness': 'Health & Wellness',
  'Träning & Fitness': 'Training & Fitness',
  'Hem & Inredning': 'Home & Interior',
  'Böcker & Litteratur': 'Books & Literature',
  'Fordon': 'Vehicles',
  'Barn & Familj': 'Kids & Family',
  'Djur': 'Animals',
  'Hållbarhet & Miljö': 'Sustainability & Environment',
  'iPhone-bilder i HEIC-format stöds inte av webbläsaren — spara om bilden som JPG/PNG och försök igen': 'HEIC photos from iPhone are not supported by the browser — re-save the image as JPG/PNG and try again',
  'Bilden kunde inte läsas — prova en JPG- eller PNG-fil': 'The image could not be read — try a JPG or PNG file',
};
