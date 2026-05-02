import React from 'react';
import LegalDocumentPage from '../components/common/LegalDocumentPage';

const LegalUserAgreement: React.FC = () => (
  <LegalDocumentPage
    title="Пользовательское соглашение"
    textUrl="/legal/user_agreement_site.txt"
    downloadUrl="/legal/Пользовательское_соглашение_сайта.docx"
  />
);

export default LegalUserAgreement; 