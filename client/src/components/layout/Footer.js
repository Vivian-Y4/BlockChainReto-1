import React from 'react';
import { Container } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="bg-dark text-white py-4 mt-auto">
      <Container>
        <div className="row">
          <div className="col-md-6">
            <h5>{t('app.title')}</h5>
            <p className="text-muted">
              {t('footer.description')}
            </p>
          </div>
          <div className="col-md-3">
            <h5>{t('footer.links')}</h5>
            <ul className="list-unstyled">
              <li><a href="/" className="text-white">{t('navbar.home')}</a></li>
              <li><a href="/elections" className="text-white">{t('navbar.elections')}</a></li>
              <li><a href="/about" className="text-white">About</a></li>
              <li><a href="/help" className="text-white">Help</a></li>
            </ul>
          </div>
          <div className="col-md-3">
            <h5>{t('footer.resources')}</h5>
            <ul className="list-unstyled">
              <li><a href="https://ethereum.org/" target="_blank" rel="noreferrer" className="text-white">Ethereum</a></li>
              <li><a href="https://metamask.io/" target="_blank" rel="noreferrer" className="text-white">MetaMask</a></li>
              <li><a href="https://docs.soliditylang.org/" target="_blank" rel="noreferrer" className="text-white">Solidity</a></li>
              <li><a href="https://reactjs.org/" target="_blank" rel="noreferrer" className="text-white">React</a></li>
            </ul>
          </div>
        </div>
        <hr />
        <div className="text-center">
          <p className="mb-0">&copy; {new Date().getFullYear()} {t('app.title')}. {t('footer.copyright')}</p>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
