from django.db import models


class Employee(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('EXITED', 'Exited'),
    ]
    
    emp_id = models.CharField(max_length=20, unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(max_length=150, unique=True)
    phone = models.CharField(max_length=15, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    designation = models.CharField(max_length=100, blank=True, null=True)
    joining_date = models.DateField()
    exit_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_master'

    def __str__(self):
        return f"{self.emp_id} - {self.first_name} {self.last_name}"


class BankDetail(models.Model):
    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name='bank_detail')
    account_holder_name = models.CharField(max_length=150, blank=True, null=True)
    account_number = models.CharField(max_length=20, blank=True, null=True)
    ifsc_code = models.CharField(max_length=15, blank=True, null=True)
    bank_name = models.CharField(max_length=150, blank=True, null=True)
    branch_name = models.CharField(max_length=150, blank=True, null=True)
    account_type = models.CharField(max_length=50, blank=True, null=True, help_text="Savings/Current/etc")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_bank_details'

    def __str__(self):
        return f"Bank - {self.employee.emp_id}"


class ComplianceID(models.Model):
    COMPLIANCE_TYPES = [
        ('PAN', 'PAN Card'),
        ('AADHAAR', 'Aadhaar Card'),
        ('PASSPORT', 'Passport'),
        ('DL', 'Driving License'),
        ('VOTER_ID', 'Voter ID'),
    ]
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='compliance_ids')
    compliance_type = models.CharField(max_length=50, choices=COMPLIANCE_TYPES)
    compliance_id = models.CharField(max_length=100)
    issued_date = models.DateField(blank=True, null=True)
    validity_date = models.DateField(blank=True, null=True)
    issuing_authority = models.CharField(max_length=150, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_compliance_ids'
        unique_together = ('employee', 'compliance_type')

    def __str__(self):
        return f"{self.compliance_type} - {self.employee.emp_id}"


class CTCHistory(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='ctc_history')
    ctc_amount = models.DecimalField(max_digits=15, decimal_places=2)
    effective_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_ctc_history'
        ordering = ['-effective_date']
        unique_together = ('employee', 'effective_date')

    def __str__(self):
        return f"CTC {self.ctc_amount} - {self.employee.emp_id} ({self.effective_date})"


class PastExperience(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='past_experiences')
    company_name = models.CharField(max_length=200)
    designation = models.CharField(max_length=150)
    department = models.CharField(max_length=150, blank=True, null=True)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee_past_experiences'
        ordering = ['-end_date', '-start_date']

    def __str__(self):
        return f"{self.designation} at {self.company_name} - {self.employee.emp_id}"


class OnboardingChecklist(models.Model):
    CHECKLIST_ITEMS = [
        ('PAN_CARD', 'PAN Card'),
        ('AADHAAR_CARD', 'Aadhaar Card'),
        ('UAN_EPF', 'UAN/EPF Account Number'),
        ('ESI', 'ESI Number'),
        ('BANK_DETAILS', 'Bank Details'),
        ('PASSPORT', 'Passport'),
        ('DRIVING_LICENSE', 'Driving License'),
        ('FORM_COMPLETED', 'Onboarding Form'),
        ('DOCUMENTS_VERIFIED', 'Documents Verified'),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='onboarding_checklist')
    item_name = models.CharField(max_length=50, choices=CHECKLIST_ITEMS)
    is_completed = models.BooleanField(default=False)
    document_url = models.CharField(max_length=500, blank=True, null=True)
    completed_date = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'onboarding_checklist'
        unique_together = ('employee', 'item_name')
        ordering = ['item_name']

    def __str__(self):
        return f"{self.get_item_name_display()} - {self.employee.emp_id} - {'✓' if self.is_completed else '✗'}"
