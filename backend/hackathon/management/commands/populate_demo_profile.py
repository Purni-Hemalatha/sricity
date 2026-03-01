from django.core.management.base import BaseCommand
from datetime import date
from hackathon.models import Employee, BankDetail, ComplianceID, CTCHistory


class Command(BaseCommand):
    help = 'Populate sample employee data with complete profile for demonstration'

    def handle(self, *args, **options):
        # Check if demo employee already exists
        if Employee.objects.filter(emp_id='DEMO001').exists():
            self.stdout.write(self.style.WARNING('Demo employee DEMO001 already exists. Skipping...'))
            return

        try:
            # Create demo employee
            emp = Employee.objects.create(
                emp_id='DEMO001',
                first_name='John',
                last_name='Doe',
                email='john.doe@example.com',
                phone='+91-9876543210',
                department='Engineering',
                designation='Senior Software Engineer',
                joining_date=date(2020, 1, 15),
                status='ACTIVE'
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Created employee: {emp}'))

            # Add bank details
            bank = BankDetail.objects.create(
                employee=emp,
                account_holder_name='John Doe',
                account_number='1234567890123456',
                ifsc_code='SBIN0001234',
                bank_name='State Bank of India',
                branch_name='Mumbai Downtown Branch',
                account_type='Savings'
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Added bank details: {bank.bank_name}'))

            # Add compliance IDs
            pan = ComplianceID.objects.create(
                employee=emp,
                compliance_type='PAN',
                compliance_id='ABCDE1234F',
                issued_date=date(2015, 6, 20),
                issuing_authority='Indian Income Tax Department'
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Added PAN compliance: {pan.compliance_id}'))

            aadhaar = ComplianceID.objects.create(
                employee=emp,
                compliance_type='AADHAAR',
                compliance_id='123456789012',
                issued_date=date(2012, 3, 10),
                validity_date=date(2032, 3, 10),
                issuing_authority='Unique Identification Authority of India (UIDAI)'
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Added Aadhaar compliance: {aadhaar.compliance_id}'))

            passport = ComplianceID.objects.create(
                employee=emp,
                compliance_type='PASSPORT',
                compliance_id='P12345678',
                issued_date=date(2018, 5, 10),
                validity_date=date(2028, 5, 10),
                issuing_authority='Ministry of External Affairs'
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Added Passport compliance: {passport.compliance_id}'))

            # Add CTC history
            ctc1 = CTCHistory.objects.create(
                employee=emp,
                ctc_amount=2400000.00,
                effective_date=date(2024, 4, 1)
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Added CTC: ₹{ctc1.ctc_amount} (Current)'))

            ctc2 = CTCHistory.objects.create(
                employee=emp,
                ctc_amount=2200000.00,
                effective_date=date(2023, 4, 1)
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Added CTC: ₹{ctc2.ctc_amount}'))

            ctc3 = CTCHistory.objects.create(
                employee=emp,
                ctc_amount=2000000.00,
                effective_date=date(2022, 4, 1)
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Added CTC: ₹{ctc3.ctc_amount}'))

            ctc4 = CTCHistory.objects.create(
                employee=emp,
                ctc_amount=1800000.00,
                effective_date=date(2021, 4, 1)
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Added CTC: ₹{ctc4.ctc_amount}'))

            self.stdout.write(self.style.SUCCESS('\n✓ Demo employee profile successfully created!'))
            self.stdout.write(self.style.SUCCESS(f'\nYou can now view the profile at:'))
            self.stdout.write(self.style.SUCCESS(f'  - Frontend: http://127.0.0.1:5173/employees/1/profile'))
            self.stdout.write(self.style.SUCCESS(f'  - API: http://127.0.0.1:8000/api/profile/1'))
            self.stdout.write(self.style.SUCCESS(f'  - By emp_id: http://127.0.0.1:8000/api/profile/DEMO001'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'✗ Error creating demo data: {str(e)}'))
