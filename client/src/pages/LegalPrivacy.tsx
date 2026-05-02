import React from 'react';
import LegalDocumentPage from '../components/common/LegalDocumentPage';

const LegalPrivacy: React.FC = () => (
  <LegalDocumentPage
    title="Правила обработки персональных данных и политика конфиденциальности"
    textUrl="/legal/privacy_rules_policy.txt"
    downloadUrl="/legal/Правила_обработки_персональных_данных_и_политика_конфиденциальности.docx"
  />
);

export default LegalPrivacy; 