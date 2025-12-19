import { render, screen } from '@testing-library/react'
import Footer from '@/components/Footer'
import { SOCIAL_MEDIA_LINKS } from '@/lib/socialMediaLinks'

describe('Footer', () => {
  it('renders footer with company name', () => {
    render(<Footer />)
    expect(screen.getByText('Wild Bean Coffee')).toBeInTheDocument()
  })

  it('renders current year in copyright', () => {
    render(<Footer />)
    const currentYear = new Date().getFullYear()
    expect(screen.getByText(new RegExp(currentYear.toString()))).toBeInTheDocument()
  })

  it('renders all quick links', () => {
    render(<Footer />)
    expect(screen.getByText('Shop Coffee Beans')).toBeInTheDocument()
    expect(screen.getByText('Menu')).toBeInTheDocument()
    expect(screen.getByText('Location & Hours')).toBeInTheDocument()
    expect(screen.getByText('Order Online')).toBeInTheDocument()
  })

  it('renders contact section', () => {
    render(<Footer />)
    expect(screen.getByText('Contact')).toBeInTheDocument()
  })

  it('has correct link hrefs', () => {
    render(<Footer />)
    expect(screen.getByText('Shop Coffee Beans').closest('a')).toHaveAttribute('href', '/shop')
    expect(screen.getByText('Menu').closest('a')).toHaveAttribute('href', '/menu')
    expect(screen.getByText('Location & Hours').closest('a')).toHaveAttribute('href', '/location')
    expect(screen.getByText('Order Online').closest('a')).toHaveAttribute('href', '/order')
  })

  it('renders social media links', () => {
    render(<Footer />)
    const instagramLink = screen.getByLabelText('Follow us on Instagram')
    const facebookLink = screen.getByLabelText('Follow us on Facebook')
    const tiktokLink = screen.getByLabelText('Follow us on TikTok')
    expect(instagramLink).toBeInTheDocument()
    expect(facebookLink).toBeInTheDocument()
    expect(tiktokLink).toBeInTheDocument()
    expect(instagramLink).toHaveAttribute('href', SOCIAL_MEDIA_LINKS.instagram)
    expect(facebookLink).toHaveAttribute('href', SOCIAL_MEDIA_LINKS.facebook)
    expect(tiktokLink).toHaveAttribute('href', SOCIAL_MEDIA_LINKS.tiktok)
  })
})

