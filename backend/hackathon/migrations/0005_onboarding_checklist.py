# Generated migration for OnboardingChecklist model

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hackathon', '0004_pastexperience'),
    ]

    operations = [
        migrations.CreateModel(
            name='OnboardingChecklist',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('item_name', models.CharField(choices=[('PAN_CARD', 'PAN Card'), ('AADHAAR_CARD', 'Aadhaar Card'), ('UAN_EPF', 'UAN/EPF Account Number'), ('ESI', 'ESI Number'), ('BANK_DETAILS', 'Bank Details'), ('PASSPORT', 'Passport'), ('DRIVING_LICENSE', 'Driving License'), ('FORM_COMPLETED', 'Onboarding Form'), ('DOCUMENTS_VERIFIED', 'Documents Verified')], max_length=50)),
                ('is_completed', models.BooleanField(default=False)),
                ('document_url', models.CharField(blank=True, max_length=500, null=True)),
                ('completed_date', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='onboarding_checklist', to='hackathon.employee')),
            ],
            options={
                'db_table': 'onboarding_checklist',
                'ordering': ['item_name'],
                'unique_together': {('employee', 'item_name')},
            },
        ),
    ]
