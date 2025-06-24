# Security Policy

Hey there! Thanks for checking out Open Store. I'm still learning and building this project, so your help with security is super appreciated.

## Supported Versions

Right now, I only provide security updates for these versions:

| Version | Supported |
| ------- | --------- |
| 1.x.x   | ✅        |
| 0.x.x   | ❌        |

## Found a Security Issue?

If you spot a security problem, please let me know! I'm learning as I go, so any heads-up is helpful.

### How to Report

1. **Email**: Reach out at [tolu.adegbehingbe@icloud.com] or open a private GitHub issue.
2. **What to include**:
   - What the vulnerability is
   - How to reproduce it
   - What could go wrong
   - Any ideas for a fix (if you have one)

### How I Handle Reports

- I’d appreciate up to 90 days to look into and fix issues before they’re made public.
- I’ll give you credit unless you’d rather stay anonymous.
- I’ll work with you on when to announce the fix.

## Tips for Staying Secure

Some things to keep in mind when using Open Store:

### Data Stuff

- Don’t put sensitive info (like passwords or tokens) in the store unless it’s encrypted.
- Double-check data before saving it.
- Be careful with how you save and load store data.

### If You’re Using React

- Clean up any user input before saving it to state.
- Watch out for XSS when showing store data.
- Stick to React’s safety features—don’t bypass them.

### Storage Plugins

- Only use storage plugins you trust.
- Check data when loading from storage.
- Encrypt sensitive stuff if you’re saving it long-term.

## Dependencies

I try to keep things safe by checking dependencies:

- **Immer**: For handling state changes
- **React**: Only needed if you’re using React features

## Non-Security Issues?

If you find a regular bug or have a question, please use [GitHub Issues](https://github.com/toluLikesToCode/universal-store/issues).

## Contact

Got a security question? Email me at [tolu.adegbehingbe@icloud.com].

Thanks for helping me make Open Store better!
