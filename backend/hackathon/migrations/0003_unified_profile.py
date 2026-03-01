from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('hackathon', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='BankDetail',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('account_holder_name', models.CharField(blank=True, max_length=150, null=True)),
                ('account_number', models.CharField(blank=True, max_length=20, null=True)),
                ('ifsc_code', models.CharField(blank=True, max_length=15, null=True)),
                ('bank_name', models.CharField(blank=True, max_length=150, null=True)),
                ('branch_name', models.CharField(blank=True, max_length=150, null=True)),
                ('account_type', models.CharField(blank=True, help_text='Savings/Current/etc', max_length=50, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('employee', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='bank_detail', to='hackathon.employee')),
            ],
            options={
                'db_table': 'employee_bank_details',
            },
        ),
        migrations.CreateModel(
            name='ComplianceID',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('compliance_type', models.CharField(choices=[('PAN', 'PAN Card'), ('AADHAAR', 'Aadhaar Card'), ('PASSPORT', 'Passport'), ('DL', 'Driving License'), ('VOTER_ID', 'Voter ID')], max_length=50)),
                ('compliance_id', models.CharField(max_length=100)),
                ('issued_date', models.DateField(blank=True, null=True)),
                ('validity_date', models.DateField(blank=True, null=True)),
                ('issuing_authority', models.CharField(blank=True, max_length=150, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='compliance_ids', to='hackathon.employee')),
            ],
            options={
                'db_table': 'employee_compliance_ids',
                'unique_together': {('employee', 'compliance_type')},
            },
        ),
        migrations.CreateModel(
            name='CTCHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ctc_amount', models.DecimalField(decimal_places=2, max_digits=15)),
                ('effective_date', models.DateField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ctc_history', to='hackathon.employee')),
            ],
            options={
                'db_table': 'employee_ctc_history',
                'ordering': ['-effective_date'],
                'unique_together': {('employee', 'effective_date')},
            },
        ),
    ]
