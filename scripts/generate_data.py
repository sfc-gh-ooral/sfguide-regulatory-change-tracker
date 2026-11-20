"""Seeded, deterministic generator for the Regulatory Change Tracker example.

Writes 25 synthetic regulatory notices as PDFs to data/notices/ (24 for the first load and
one in data/incoming/ that the Snowflake task picks up later), and the firm's policy
library, controls, owners and prior gap records to data/csv/.

Every regulator, firm, person and rule here is fictional and written for this example.
Nothing is copied from real regulatory text. Run: python3 scripts/generate_data.py
"""
import csv
import random
from pathlib import Path

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

random.seed(17)
ROOT = Path(__file__).resolve().parent.parent
CSV_DIR, NOTICE_DIR, INCOMING_DIR = ROOT / "data/csv", ROOT / "data/notices", ROOT / "data/incoming"
for d in (CSV_DIR, NOTICE_DIR, INCOMING_DIR):
    d.mkdir(parents=True, exist_ok=True)
    for f in d.glob("*"):
        f.unlink()

# Fictional regulators. None of these bodies exist.
REG = {
    "RCA": "Retail Conduct Authority",
    "PBB": "Prudential Banking Board",
    "FDPO": "Financial Data Protection Office",
    "POC": "Payments Oversight Council",
    "AMLD": "Anti-Money Laundering Directorate",
    "ICO": "Insurance Conduct Office",
    "SMC": "Securities Markets Commission",
}

# ---------------------------------------------------------------------------------------------
# Notices: (id, regulator, type, title, published, effective, scope, background, requirements,
# story). Requirements are numbered so the PDF reads like a rule; AI_EXTRACT pulls them out.
# ---------------------------------------------------------------------------------------------
N = [
    ("RCN-2026-001", "RCA", "Final rule", "Overdraft fee transparency", "2026-08-04", "2027-02-01",
     "Banks and credit unions that offer deposit accounts with an overdraft service to consumers.",
     "Consumers told the Authority that overdraft fees often come as a surprise, because the fee is only visible on a statement days later. This rule makes the fee visible at the moment a consumer can still change course.",
     ["Before an overdraft fee is charged on a card or app transaction, a firm must show the consumer the fee amount and give a choice to cancel the transaction.",
      "A firm must send each consumer a monthly summary of all overdraft and returned-item fees charged in the previous month, with a year-to-date total."], None),
    ("RCN-2026-002", "FDPO", "Guidance", "Responding to customer data access requests", "2026-08-11", "2026-12-01",
     "Any firm that holds personal data about retail customers.",
     "The Office has reviewed how financial firms handle requests from customers who want a copy of the data held about them. Response times varied widely and records of requests were often incomplete.",
     ["A firm must respond to a customer data access request within 30 calendar days of receiving it, providing a copy of the personal data held.",
      "A firm must keep a log of every data access request, including the date received, the date answered and the outcome."], None),
    ("RCN-2026-003", "PBB", "Final rule", "Operational resilience of important business services", "2026-08-18", "2027-03-31",
     "Deposit-taking institutions with more than 1 billion in total assets.",
     "Disruptions to payments, card authorization and online banking can cause serious harm to customers. Firms are expected to plan on the basis that disruption will happen.",
     ["A firm must identify its important business services and set an impact tolerance for the maximum tolerable disruption of each.",
      "A firm must test its ability to remain within impact tolerance through severe but plausible scenario exercises at least once a year.",
      "The board must approve the list of important business services and impact tolerances each year."], None),
    ("RCN-2026-004", "RCA", "Final rule", "Complaint handling timelines", "2026-09-01", "2027-01-15",
     "All firms that handle complaints from retail customers about banking, lending or payment products.",
     "Customers wait too long for a final answer to their complaints. The Authority is shortening the maximum time allowed for a final response and asking firms to learn from the complaints they receive. The previous limit of 30 calendar days is withdrawn.",
     ["A firm must acknowledge a complaint in writing within 2 business days of receiving it.",
      "A firm must send the customer a final response within 15 business days of receiving a complaint.",
      "A firm must analyze the root causes of complaints at least quarterly and report the findings to senior management."], "deadline"),
    ("RCN-2026-005", "AMLD", "Guidance", "Beneficial ownership for business customers", "2026-09-08", "2027-01-01",
     "Banks that open accounts for companies, partnerships and other legal entities.",
     "Criminals continue to hide behind layers of company ownership. The Directorate expects firms to know who ultimately owns and controls their business customers.",
     ["A firm must identify and verify every individual who owns 25 percent or more of a business customer before opening the account.",
      "A firm must refresh beneficial ownership information for high-risk business customers at least once a year."], None),
    ("RCN-2026-006", "POC", "Final rule", "Reimbursement for authorized push payment scams", "2026-09-15", "2027-04-01",
     "Payment service providers that send instant or same-day account-to-account payments for consumers.",
     "Victims of scams that trick them into sending money should not bear the loss alone. The Council sets a reimbursement standard and asks firms to warn customers before risky payments.",
     ["A firm must reimburse an eligible scam victim within 5 business days of the claim, unless it has evidence of gross negligence or first-party fraud.",
      "A firm must check the payee name against the account and show the customer a warning when the name does not match before a first payment to a new payee."], None),
    ("RCN-2026-007", "RCA", "Guidance", "Keeping complaint records", "2026-09-22", "2027-01-15",
     "All firms that handle complaints from retail customers.",
     "Supervisors reviewing complaint handling often find that the original correspondence has already been deleted. Complete records are needed to review how a complaint was handled.",
     ["A firm must retain records of each complaint, including all correspondence with the customer, for at least 7 years from the final response.",
      "A firm must provide complaint records to the Authority within 10 business days of a request."], "conflict"),
    ("RCN-2026-008", "FDPO", "Final rule", "Personal data breach notification", "2026-09-29", "2027-01-01",
     "Any firm that holds personal data about retail customers.",
     "Prompt notification lets the Office and customers limit the harm from a data breach.",
     ["A firm must notify the Financial Data Protection Office of a personal data breach within 72 hours of becoming aware of it.",
      "A firm must notify affected customers without undue delay when a breach is likely to put them at high risk."], None),
    ("RCN-2026-009", "PBB", "Guidance", "Managing critical third parties", "2026-10-02", "2027-03-31",
     "Deposit-taking institutions that rely on outsourced or cloud services for important business services.",
     "Firms increasingly depend on a few technology suppliers. The Board expects firms to understand that dependency and to be able to leave a supplier safely.",
     ["A firm must keep a register of third parties that support important business services.",
      "A firm must maintain a tested exit plan for each critical third-party arrangement.",
      "A firm must review the performance and risk of each critical third party at least once a year."], None),
    ("RCN-2026-010", "RCA", "Final rule", "Customers in vulnerable circumstances", "2026-10-06", "2027-02-01",
     "All firms that serve retail customers.",
     "Health problems, life events, low financial resilience or low capability can make customers more likely to suffer harm. Firms should notice and respond.",
     ["A firm must record, with the customer's consent, any vulnerability a customer discloses, so that staff can adapt how they serve that customer.",
      "A firm must train customer-facing staff to recognize and respond to signs of vulnerability at least once a year."], None),
    ("RCN-2026-011", "PBB", "Guidance", "Third-party AI models in credit decisions", "2026-10-09", "2027-06-30",
     "Lenders that use models or AI services supplied by third parties to approve, decline or price consumer credit.",
     "Lenders are adopting scoring and decision models supplied by vendors, including machine learning and generative AI services. Lenders remain accountable for these models even when they did not build them.",
     ["A firm must maintain an inventory of third-party AI models used in consumer credit decisions, recording the supplier, purpose and the products affected.",
      "The model risk committee must review each third-party AI model in the inventory at least once a year, including its performance and fairness results."], "nocontrol"),
    ("RCN-2026-012", "AMLD", "Final rule", "Suspicious activity reporting timeliness", "2026-10-13", "2027-01-01",
     "All firms subject to anti-money laundering obligations.",
     "Late reports reduce their value to law enforcement. The Directorate sets a firm deadline and asks boards to oversee reporting.",
     ["A firm must file a suspicious activity report within 30 calendar days of first detecting the suspicious activity.",
      "A firm must report suspicious activity reporting volumes and timeliness to the board at least quarterly."], None),
    ("RCN-2026-013", "RCA", "Final rule", "Credit card minimum payment warnings", "2026-10-16", "2027-05-01",
     "Card issuers that offer revolving credit cards to consumers.",
     "Customers who pay only the minimum each month can stay in debt for many years. A clear warning helps them see the cost.",
     ["A card issuer must show on each monthly statement how long it would take to repay the balance by paying only the minimum, and the total interest that would be paid."], None),
    ("RCN-2026-014", "POC", "Guidance", "Fraud monitoring for instant payments", "2026-10-20", "2027-04-01",
     "Payment service providers that send instant payments.",
     "Instant payments settle in seconds, so fraud controls must act before the money leaves.",
     ["A firm must screen outgoing instant payments for fraud in real time, before the payment is released.",
      "A firm must give customers a way to report fraud that is available 24 hours a day, every day."], None),
    ("RCN-2026-015", "PBB", "Final rule", "Liquidity stress testing", "2026-10-23", "2027-03-31",
     "Deposit-taking institutions with more than 1 billion in total assets.",
     "Recent deposit outflows moved faster than many firms had assumed. Stress tests must reflect how quickly digital deposits can leave.",
     ["A firm must run liquidity stress tests at least monthly, including a scenario with rapid outflows of digital deposits.",
      "A firm must hold enough liquid assets to cover the net outflows of its most severe stress scenario for at least 30 days."], None),
    ("RCN-2026-016", "ICO", "Final rule", "Annuity suitability assessments", "2026-10-27", "2027-03-01",
     "Insurers and insurance intermediaries that sell or recommend fixed or variable annuities to consumers.",
     "Annuities are long-term commitments with surrender charges. Sellers must make sure an annuity suits the customer before the sale.",
     ["An insurer or insurance intermediary must complete a written suitability assessment before recommending an annuity to a consumer.",
      "An insurer must disclose surrender charges and the surrender period before the consumer signs an annuity contract."], "notapplicable"),
    ("RCN-2026-017", "SMC", "Final rule", "Best execution reporting for equity orders", "2026-10-30", "2027-04-01",
     "Registered broker-dealers that route customer equity orders.",
     "Investors need to see where their orders were sent and what price they received.",
     ["A broker-dealer must publish a quarterly report on the venues to which it routed customer equity orders and the execution quality obtained."], None),
    ("RCN-2026-018", "RCA", "Guidance", "Accessible communications", "2026-11-03", "2027-02-01",
     "All firms that send statements and notices to retail customers.",
     "Customers with sight loss or other disabilities must be able to read the information firms send them.",
     ["A firm must offer statements and important notices in large print, braille or a screen-reader friendly format on request, at no extra cost."], None),
    ("RCN-2026-019", "FDPO", "Guidance", "Records of marketing consent", "2026-11-05", "2027-01-01",
     "Any firm that sends electronic marketing to individuals.",
     "Firms must be able to show that customers agreed to receive marketing, and stop promptly when they withdraw consent.",
     ["A firm must keep a record of when and how each customer gave consent to electronic marketing.",
      "A firm must stop sending electronic marketing within 10 days after a customer withdraws consent."], None),
    ("RCN-2026-020", "RCA", "Final rule", "Mortgage arrears and forbearance", "2026-11-06", "2027-02-01",
     "Firms that lend or service residential mortgages.",
     "Early contact gives borrowers in difficulty the best chance to recover.",
     ["A firm must contact a mortgage borrower within 15 calendar days after a payment is missed.",
      "A firm must offer a borrower in financial difficulty forbearance options, such as a temporary payment reduction, before starting repossession proceedings."], None),
    ("RCN-2026-021", "AMLD", "Bulletin", "Sanctions list updates", "2026-11-09", "2026-12-15",
     "All firms subject to sanctions screening obligations.",
     "Sanctions designations now change more often. Screening must catch up quickly.",
     ["A firm must screen its customer base against each update to the sanctions list within 24 hours of the update being published."], None),
    ("RCN-2026-022", "PBB", "Final rule", "Reporting significant cyber incidents", "2026-11-10", "2027-03-31",
     "Deposit-taking institutions.",
     "Supervisors need early warning of cyber incidents that could disrupt services across the sector.",
     ["A firm must report a significant cyber incident to the Prudential Banking Board within 24 hours of determining that the incident is significant.",
      "A firm must send the Prudential Banking Board a final incident report with root cause and remediation within 30 days after the incident is resolved."], None),
    ("RCN-2026-023", "RCA", "Consultation", "Limits on debt collection contacts", "2026-11-12", "2027-06-01",
     "Firms that collect consumer debts, including debts they originated.",
     "The Authority proposes limits on how often collectors may call consumers. Comments are invited until 15 January 2027.",
     ["A firm must not call a consumer about a particular debt more than 7 times within 7 days.",
      "A firm must honor a consumer's request to be contacted only in writing."], None),
    ("RCN-2026-024", "POC", "Final rule", "Notifying customers of payment outages", "2026-11-13", "2027-02-01",
     "Payment service providers serving consumers.",
     "Customers need to know quickly when they cannot make payments, so they can use another way to pay.",
     ["A firm must post a notice in its app and on its website within 1 hour of an outage that prevents customers from making payments."], None),
    # Held back: setup copies this file onto the stage later so the task processes it.
    ("RCN-2026-025", "RCA", "Final rule", "Advance notice of fee increases", "2026-11-16", "2027-03-01",
     "Banks and credit unions that offer deposit accounts to consumers.",
     "Customers need time to compare products before a fee increase takes effect.",
     ["A firm must give consumers at least 60 days' written notice before increasing a fee on a deposit account."], "incoming"),
]

# ---------------------------------------------------------------------------------------------
# The firm's policy library: (policy_id, title, owner team, text).
# ---------------------------------------------------------------------------------------------
P = [
    ("POL-CMP-01", "Complaint Handling Procedure", "Customer Care",
     "Every complaint is logged in the complaints system on the day it is received. The complaints team acknowledges each complaint in writing within 2 business days. A final response letter is sent within 30 calendar days of receipt, explaining the outcome and the customer's right to escalate. Complaint files, including all letters and emails with the customer, are retained for 7 years after the final response."),
    ("POL-CMP-02", "Complaint Root Cause Analysis Standard", "Customer Care",
     "The complaints quality team groups complaints by product and cause every quarter. Findings and recommended fixes are presented to the Executive Risk Committee each quarter, and owners are assigned to each fix."),
    ("POL-REC-01", "Records Retention Standard", "Records Management",
     "Account opening records are kept for 7 years after the relationship ends. Transaction records are kept for 7 years. Customer communications, including emails, letters and complaint correspondence, are deleted 5 years after they were created, to limit the personal data the bank holds."),
    ("POL-REC-02", "Regulatory Requests Procedure", "Regulatory Affairs",
     "Requests for information from supervisors are logged by Regulatory Affairs, assigned an owner and answered within the deadline set by the supervisor, or within 10 business days if none is given."),
    ("POL-FEE-01", "Fees and Charges Disclosure Policy", "Retail Products",
     "Fees are disclosed in the account schedule before an account is opened. Before an overdraft fee is charged on a card or app transaction, the app shows the fee and lets the customer cancel. Customers receive a monthly statement of all fees charged, with a year-to-date total."),
    ("POL-FEE-02", "Pricing Change Notification Procedure", "Retail Products",
     "Customers are given at least 60 days' written notice before any fee on a deposit account increases. Notices are sent by the customer's preferred channel and the change is published on the website on the same day."),
    ("POL-PRV-01", "Privacy and Data Subject Rights Procedure", "Privacy Office",
     "Requests from customers for a copy of their personal data are logged in the privacy request tracker with the date received, the date answered and the outcome. Requests are answered within 30 calendar days."),
    ("POL-PRV-02", "Personal Data Breach Response Procedure", "Privacy Office",
     "Suspected personal data breaches are reported to the Privacy Office immediately. The Privacy Office notifies the Financial Data Protection Office within 72 hours of the bank becoming aware of a breach, and notifies affected customers without undue delay when the risk to them is high."),
    ("POL-PRV-03", "Marketing Consent Standard", "Marketing",
     "Electronic marketing is sent only to customers who have opted in. The date, channel and wording of each opt-in are stored in the consent register. Withdrawals of consent are applied within 5 days."),
    ("POL-RES-01", "Operational Resilience Policy", "Operational Risk",
     "The bank maintains a list of important business services, each with an impact tolerance for maximum tolerable disruption. The Board approves the list and tolerances annually. Each service is tested against severe but plausible scenarios at least once a year."),
    ("POL-RES-02", "Business Continuity Standard", "Operational Risk",
     "Each business unit keeps a continuity plan with recovery time objectives and contact trees. Plans are reviewed annually and tested every two years."),
    ("POL-RES-03", "Payment Outage Communication Procedure", "Payments Operations",
     "When customers cannot make payments, Payments Operations posts a status message in the mobile app and on the website within 1 hour, and updates it every 2 hours until service is restored."),
    ("POL-TPR-01", "Third-Party Risk Management Policy", "Procurement",
     "All suppliers are recorded in the supplier register with a criticality rating. Suppliers that support important business services are reviewed for performance and risk at least once a year. Each critical supplier has a documented exit plan that is tested every two years."),
    ("POL-TPR-02", "Cloud Outsourcing Standard", "Technology Risk",
     "Cloud services that hold customer data require a security assessment before use, contractual audit rights, and data location controls."),
    ("POL-AML-01", "Customer Due Diligence Policy", "Financial Crime Compliance",
     "Customers are identified and verified before an account is opened. For business customers, every individual owning 25 percent or more is identified and verified before account opening. Beneficial ownership for high-risk business customers is refreshed every year, and for other business customers every three years."),
    ("POL-AML-02", "Suspicious Activity Reporting Procedure", "Financial Crime Compliance",
     "Alerts are investigated by the financial intelligence unit. Suspicious activity reports are filed within 30 calendar days of first detection. Volumes and timeliness are reported to the Board Risk Committee each quarter."),
    ("POL-AML-03", "Sanctions Screening Standard", "Financial Crime Compliance",
     "Customers and payments are screened against sanctions lists. When a sanctions list is updated, the full customer base is rescreened within 24 hours of publication."),
    ("POL-FRD-01", "Payment Fraud Prevention Policy", "Fraud Management",
     "Outgoing instant payments are scored by the real-time fraud engine before release. Customers can report fraud by phone or in the app 24 hours a day, every day."),
    ("POL-FRD-02", "Scam Reimbursement Procedure", "Fraud Management",
     "Scam claims are assessed against the reimbursement standard. Eligible victims are reimbursed within 5 business days unless there is evidence of gross negligence or first-party fraud. A confirmation-of-payee check runs before the first payment to a new payee, and a warning is shown when the name does not match."),
    ("POL-VUL-01", "Vulnerable Customers Policy", "Customer Care",
     "With the customer's consent, colleagues record disclosed vulnerabilities in the customer profile so service can be adapted. All customer-facing colleagues complete vulnerability training every year."),
    ("POL-ACC-01", "Accessibility Standard", "Customer Care",
     "Statements and important notices are available in large print, braille and screen-reader friendly formats on request, free of charge."),
    ("POL-CRD-01", "Credit Card Statement Standard", "Card Products",
     "Monthly card statements show the balance, the minimum payment, the due date, and a minimum-payment warning with the time to repay and total interest if only the minimum is paid."),
    ("POL-CRD-02", "Credit Card Collections Procedure", "Collections",
     "Collections agents contact customers in arrears by phone, text and letter. Calls about one debt are limited to 7 in any 7-day period. Requests to be contacted only in writing are recorded and honored."),
    ("POL-MTG-01", "Mortgage Arrears Management Procedure", "Mortgage Servicing",
     "A borrower who misses a payment is contacted within 10 calendar days. Borrowers in financial difficulty are offered forbearance options, including temporary payment reductions and term extensions, before any repossession proceedings start."),
    ("POL-MTG-02", "Mortgage Underwriting Policy", "Mortgage Lending",
     "Applications are assessed for affordability using verified income and a stressed interest rate. Loan-to-value limits are set by product."),
    ("POL-LIQ-01", "Liquidity Risk Policy", "Treasury",
     "Liquidity stress tests run monthly and include a rapid digital deposit outflow scenario. The bank holds liquid assets sufficient to cover net outflows in its most severe scenario for at least 30 days."),
    ("POL-CAP-01", "Capital Planning Policy", "Treasury",
     "Capital forecasts are produced quarterly and stress tested annually. The Board sets a minimum capital buffer above regulatory requirements."),
    ("POL-CYB-01", "Cyber Incident Response Policy", "Information Security",
     "Security incidents are triaged by the security operations center. Significant cyber incidents are reported to the Prudential Banking Board within 24 hours of being classified as significant. A final report with root cause and remediation follows within 30 days of resolution."),
    ("POL-CYB-02", "Information Security Policy", "Information Security",
     "Access to systems follows least privilege and is reviewed quarterly. Data is encrypted in transit and at rest. Vulnerabilities rated critical are patched within 14 days."),
    ("POL-MRM-01", "Model Risk Management Policy", "Model Risk",
     "Credit scorecards and pricing models built by the bank are validated by an independent model validation team before use and revalidated every two years. Model owners monitor performance monthly."),
    ("POL-FLN-01", "Fair Lending Policy", "Compliance",
     "Credit decisions are made on objective criteria. Approval and pricing outcomes are tested for disparities across protected groups each quarter, and declined applicants receive the principal reasons for the decision."),
    ("POL-MKT-01", "Advertising and Financial Promotions Standard", "Marketing",
     "Advertisements are fair, clear and not misleading. Every promotion is approved by Compliance before release and representative rates are shown with equal prominence."),
    ("POL-PRD-01", "Product Governance Policy", "Retail Products",
     "New products and material changes are approved by the Product Committee after a review of target market, value and risks. Products are reviewed every year."),
    ("POL-CON-01", "Conflicts of Interest Policy", "Compliance",
     "Colleagues declare outside interests annually. Incentive schemes are reviewed so they do not reward outcomes that harm customers."),
    ("POL-WBL-01", "Whistleblowing Policy", "Compliance",
     "Colleagues can raise concerns confidentially through a hotline. Reports are investigated independently and reported to the Audit Committee."),
    ("POL-TRN-01", "Mandatory Training Standard", "Human Resources",
     "All colleagues complete annual training on conduct, financial crime, information security and data protection. Completion is tracked and reported monthly."),
    ("POL-DEP-01", "Deposit Account Terms Policy", "Retail Products",
     "Deposit account terms are written in plain language and given to customers before account opening. Dormant accounts are identified after 12 months without activity."),
    ("POL-SBL-01", "Small Business Lending Policy", "Business Banking",
     "Small business loans are underwritten on cash flow and collateral. Personal guarantees are explained to guarantors in writing."),
    ("POL-GOV-01", "Regulatory Change Management Procedure", "Regulatory Affairs",
     "New regulatory publications are logged within 5 business days, assessed for applicability, mapped to policies and controls, and any gaps are assigned an owner and a due date before the effective date."),
    ("POL-ETH-01", "Code of Conduct", "Human Resources",
     "Colleagues act with integrity, treat customers fairly and speak up when something is wrong."),
]

# Controls: (control_id, policy_id, description, frequency). Owners are assigned below.
C = [
    ("CTL-101", "POL-CMP-01", "Daily report of complaints not acknowledged within 2 business days, reviewed by the complaints manager", "Daily"),
    ("CTL-102", "POL-CMP-01", "Weekly report of complaints open for more than 30 calendar days without a final response, escalated to the head of Customer Care", "Weekly"),
    ("CTL-103", "POL-CMP-02", "Quarterly complaint root cause pack presented to the Executive Risk Committee, with owners for each fix", "Quarterly"),
    ("CTL-104", "POL-CMP-01", "Monthly sample of 25 closed complaint files checked for complete correspondence", "Monthly"),
    ("CTL-111", "POL-REC-01", "Automated deletion job removes customer communications older than 5 years from the correspondence archive", "Monthly"),
    ("CTL-112", "POL-REC-02", "Regulatory request log reviewed weekly for requests approaching their response deadline", "Weekly"),
    ("CTL-121", "POL-FEE-01", "App release test confirms the overdraft fee prompt and cancel option appear before a fee-bearing transaction", "Per release"),
    ("CTL-122", "POL-FEE-01", "Monthly reconciliation that every account charged a fee received a fee summary with a year-to-date total", "Monthly"),
    ("CTL-123", "POL-FEE-02", "Pricing change checklist confirms customer notices were sent at least 60 days before a fee increase", "Per change"),
    ("CTL-131", "POL-PRV-01", "Weekly report of data access requests open for more than 20 days, with escalation before the 30-day limit", "Weekly"),
    ("CTL-132", "POL-PRV-02", "Breach log review confirms supervisor notification within 72 hours for each reportable breach", "Per incident"),
    ("CTL-133", "POL-PRV-03", "Monthly check that marketing send lists exclude customers who withdrew consent", "Monthly"),
    ("CTL-134", "POL-PRV-03", "Quarterly sample of opt-in records checked for date, channel and wording", "Quarterly"),
    ("CTL-141", "POL-RES-01", "Annual Board approval of important business services and impact tolerances, recorded in Board minutes", "Annual"),
    ("CTL-142", "POL-RES-01", "Annual severe-but-plausible scenario test for each important business service, with results tracked", "Annual"),
    ("CTL-143", "POL-RES-03", "Outage communication timestamps compared with outage start time after every payment outage", "Per incident"),
    ("CTL-144", "POL-RES-02", "Annual review of business continuity plans by each business unit", "Annual"),
    ("CTL-151", "POL-TPR-01", "Supplier register completeness check for suppliers supporting important business services", "Quarterly"),
    ("CTL-152", "POL-TPR-01", "Annual performance and risk review of each critical supplier", "Annual"),
    ("CTL-153", "POL-TPR-01", "Exit plan test for each critical supplier, every two years", "Biennial"),
    ("CTL-154", "POL-TPR-02", "Security assessment sign-off before onboarding any cloud service holding customer data", "Per supplier"),
    ("CTL-161", "POL-AML-01", "Account opening system blocks business accounts until owners of 25 percent or more are verified", "Continuous"),
    ("CTL-162", "POL-AML-01", "Monthly report of high-risk business customers whose beneficial ownership refresh is overdue", "Monthly"),
    ("CTL-163", "POL-AML-02", "Weekly report of investigations approaching the 30-day filing deadline", "Weekly"),
    ("CTL-164", "POL-AML-02", "Quarterly suspicious activity reporting metrics presented to the Board Risk Committee", "Quarterly"),
    ("CTL-165", "POL-AML-03", "Rescreening job runs automatically within 24 hours of each sanctions list update, with completion logged", "Per update"),
    ("CTL-171", "POL-FRD-01", "Real-time fraud engine scores every outgoing instant payment before release; bypasses are logged and reviewed", "Continuous"),
    ("CTL-172", "POL-FRD-01", "Daily test call to the 24/7 fraud reporting line", "Daily"),
    ("CTL-173", "POL-FRD-02", "Weekly report of scam claims open for more than 5 business days", "Weekly"),
    ("CTL-174", "POL-FRD-02", "Confirmation-of-payee check and name-mismatch warning tested in each app release", "Per release"),
    ("CTL-181", "POL-VUL-01", "Quarterly review of vulnerability flags recorded with consent", "Quarterly"),
    ("CTL-182", "POL-VUL-01", "Annual vulnerability training completion report for customer-facing colleagues", "Annual"),
    ("CTL-183", "POL-ACC-01", "Monthly report of accessible-format requests and their fulfilment times", "Monthly"),
    ("CTL-191", "POL-CRD-01", "Statement template review confirms the minimum-payment warning, time to repay and total interest", "Per change"),
    ("CTL-192", "POL-CRD-02", "Dialer rule limits calls about one debt to 7 in 7 days; exceptions reviewed weekly", "Continuous"),
    ("CTL-193", "POL-CRD-02", "Monthly check that written-contact-only requests are flagged in the dialer", "Monthly"),
    ("CTL-201", "POL-MTG-01", "Daily arrears report confirms contact attempts within 10 days of a missed payment", "Daily"),
    ("CTL-202", "POL-MTG-01", "Repossession checklist requires evidence that forbearance options were offered", "Per case"),
    ("CTL-203", "POL-MTG-02", "Monthly sample of mortgage approvals checked for income verification and stressed affordability", "Monthly"),
    ("CTL-211", "POL-LIQ-01", "Monthly liquidity stress test results, including the digital outflow scenario, reviewed by ALCO", "Monthly"),
    ("CTL-212", "POL-LIQ-01", "Daily check that liquid assets cover 30 days of net outflows in the most severe scenario", "Daily"),
    ("CTL-213", "POL-CAP-01", "Quarterly capital forecast reviewed by the Board Risk Committee", "Quarterly"),
    ("CTL-221", "POL-CYB-01", "Incident log review confirms supervisor notification within 24 hours of a significant classification", "Per incident"),
    ("CTL-222", "POL-CYB-01", "Final incident reports tracked to submission within 30 days of resolution", "Per incident"),
    ("CTL-223", "POL-CYB-02", "Quarterly user access review for critical systems", "Quarterly"),
    ("CTL-224", "POL-CYB-02", "Weekly report of critical vulnerabilities older than 14 days", "Weekly"),
    ("CTL-231", "POL-MRM-01", "Independent validation sign-off before an internally built credit scorecard goes live", "Per model"),
    ("CTL-232", "POL-MRM-01", "Monthly performance monitoring report for internally built credit scorecards", "Monthly"),
    ("CTL-241", "POL-FLN-01", "Quarterly fair lending disparity testing of approval and pricing outcomes", "Quarterly"),
    ("CTL-242", "POL-FLN-01", "Adverse action notices checked for principal decline reasons", "Monthly"),
    ("CTL-251", "POL-MKT-01", "Compliance approval recorded for every financial promotion before release", "Per promotion"),
    ("CTL-261", "POL-PRD-01", "Annual product review pack approved by the Product Committee", "Annual"),
    ("CTL-271", "POL-TRN-01", "Monthly mandatory training completion report", "Monthly"),
    ("CTL-281", "POL-GOV-01", "Regulatory change log reviewed weekly for items without an applicability decision", "Weekly"),
    ("CTL-282", "POL-GOV-01", "Monthly review of open regulatory gaps against effective dates", "Monthly"),
    ("CTL-291", "POL-CON-01", "Annual outside-interest declarations completed by all colleagues", "Annual"),
    ("CTL-301", "POL-WBL-01", "Quarterly whistleblowing report to the Audit Committee", "Quarterly"),
    ("CTL-311", "POL-DEP-01", "Monthly dormant account identification run", "Monthly"),
]

FIRST = ["Maya", "Daniel", "Priya", "Tomas", "Grace", "Omar", "Lena", "Samuel", "Aisha", "Marco", "Hannah", "Victor",
         "Nadia", "Elliot", "Rosa", "Kwame", "Ingrid", "Felix", "Leila", "Arjun"]
LAST = ["Okafor", "Lindqvist", "Ramos", "Chen", "Whitfield", "Haddad", "Novak", "Adeyemi", "Moreau", "Kowalski",
        "Brennan", "Sato", "Delgado", "Fischer", "Mensah", "Park", "Ivanova", "Castillo", "Byrne", "Nakamura"]
names = random.sample([f"{f} {l}" for f in FIRST for l in LAST], 30)
teams = sorted({p[2] for p in P})
team_owner = {t: names[i] for i, t in enumerate(teams)}


def write_csv(name, header, rows):
    with open(CSV_DIR / name, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


write_csv("policies.csv", ["policy_id", "title", "owner_team", "owner_name", "policy_text", "last_reviewed"],
          [(p[0], p[1], p[2], team_owner[p[2]], p[3], f"2026-{random.randint(1, 10):02d}-{random.randint(1, 28):02d}") for p in P])
pol_team = {p[0]: p[2] for p in P}
ctrl_rows = []
for cid, pid, desc, freq in C:
    owner = team_owner[pol_team[pid]] if random.random() < 0.5 else names[len(teams) + random.randint(0, 29 - len(teams))]
    ctrl_rows.append((cid, pid, desc, freq, owner, pol_team[pid]))
write_csv("controls.csv", ["control_id", "policy_id", "description", "frequency", "owner_name", "owner_team"], ctrl_rows)
write_csv("owners.csv", ["team", "owner_name"], sorted(team_owner.items()))

# Notice register: which file belongs to which notice (no labels the pipeline could read).
write_csv("notice_files.csv", ["notice_id", "file_name", "received_at", "feed"],
          [(n[0], f"{n[0]}.pdf", f"{n[4]} {8 + i % 9:02d}:{(i * 17) % 60:02d}:00", REG[n[1]] + " publications feed")
           for i, n in enumerate(N)])

# Gaps from earlier reviews, so the tracker shows work in flight and closed items with evidence.
prior = [
    ("GAP-0101", "RCN-2026-090", "Prior review", "Statement wording does not explain the new interest rate cap.", "Card Products", "2026-10-31", "Closed",
     "https://grc.example.com/evidence/EV-2026-0412"),
    ("GAP-0102", "RCN-2026-091", "Prior review", "No control evidences that dormant-account letters are sent before reclassification.", "Retail Products", "2026-12-15", "In progress",
     "https://grc.example.com/evidence/EV-2026-0433"),
    ("GAP-0103", "RCN-2026-092", "Prior review", "Training module on scam warning signs not yet assigned to branch colleagues.", "Human Resources", "2026-11-30", "Ready for review",
     "https://grc.example.com/evidence/EV-2026-0451"),
    ("GAP-0104", "RCN-2026-093", "Prior review", "Supplier register missing criticality rating for two payment processors.", "Procurement", "2026-11-20", "In progress", ""),
    ("GAP-0105", "RCN-2026-094", "Prior review", "Promotions approval log lacks reviewer name for social media posts.", "Marketing", "2026-09-30", "Closed",
     "https://grc.example.com/evidence/EV-2026-0398"),
]
write_csv("prior_gaps.csv", ["gap_id", "notice_id", "gap_type", "description", "owner_team", "due_date", "status", "evidence_url"],
          [(g[0], g[1], g[2], g[3], g[4] + " · " + team_owner[g[4]], g[5], g[6], g[7]) for g in prior])

# ---------------------------------------------------------------------------------------------
# PDF rendering
# ---------------------------------------------------------------------------------------------
def wrap(text, width=95):
    out, line = [], ""
    for w in text.split():
        if len(line) + len(w) + 1 > width:
            out.append(line)
            line = w
        else:
            line = f"{line} {w}".strip()
    return out + ([line] if line else [])


def render(n, folder):
    nid, reg, kind, title, pub, eff, scope, background, reqs, _ = n
    cv = canvas.Canvas(str(folder / f"{nid}.pdf"), pagesize=LETTER, invariant=1)
    cv.setTitle(f"{nid} {title}")
    W, H = LETTER
    y = H - 60
    cv.setFont("Helvetica-Bold", 10)
    cv.drawString(60, y, REG[reg].upper())
    cv.setFont("Helvetica", 8)
    cv.drawRightString(W - 60, y, "FICTIONAL REGULATOR - SYNTHETIC EXAMPLE")
    y -= 10
    cv.line(60, y, W - 60, y)
    y -= 30
    cv.setFont("Helvetica-Bold", 16)
    cv.drawString(60, y, f"{kind}: {title}")
    y -= 24
    cv.setFont("Helvetica", 10)
    for label, val in [("Notice number", nid), ("Issued by", REG[reg]), ("Published", pub), ("Effective date", eff)]:
        cv.setFont("Helvetica-Bold", 10)
        cv.drawString(60, y, f"{label}:")
        cv.setFont("Helvetica", 10)
        cv.drawString(160, y, val)
        y -= 15
    y -= 10

    def section(head, paras):
        nonlocal y
        cv.setFont("Helvetica-Bold", 11)
        cv.drawString(60, y, head)
        y -= 16
        cv.setFont("Helvetica", 10)
        for p in paras:
            for ln in wrap(p):
                cv.drawString(60, y, ln)
                y -= 13
            y -= 6
        y -= 6

    section("1. Who this applies to", [scope])
    section("2. Background", [background])
    section("3. Requirements", [f"3.{i + 1} {r}" for i, r in enumerate(reqs)])
    section("4. Status", ["This is a consultation. The requirements above are proposals and are not yet in force."]
            if kind == "Consultation" else [f"Firms must comply with the requirements in section 3 from {eff}."])
    cv.setFont("Helvetica-Oblique", 8)
    cv.drawString(60, 50, "Synthetic document written for a Snowflake example. The regulator, rule and numbers are fictional.")
    cv.save()


for n in N:
    render(n, INCOMING_DIR if n[9] == "incoming" else NOTICE_DIR)

print(f"{len(N)} notices, {len(P)} policies, {len(C)} controls, {len(prior)} prior gaps")
