from django.contrib import admin
from .models import Employee, BankDetail, ComplianceID, CTCHistory, PastExperience


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('emp_id', 'first_name', 'last_name', 'email', 'department', 'status', 'joining_date')
    list_filter = ('status', 'department', 'joining_date')
    search_fields = ('emp_id', 'first_name', 'last_name', 'email')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Personal Information', {
            'fields': ('emp_id', 'first_name', 'last_name', 'email', 'phone')
        }),
        ('Employment Details', {
            'fields': ('department', 'designation', 'joining_date', 'exit_date', 'status')
        }),
        ('System', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(BankDetail)
class BankDetailAdmin(admin.ModelAdmin):
    list_display = ('employee', 'bank_name', 'account_type', 'ifsc_code')
    list_filter = ('bank_name', 'account_type')
    search_fields = ('employee__emp_id', 'account_number', 'ifsc_code')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Employee Reference', {
            'fields': ('employee',)
        }),
        ('Account Information', {
            'fields': ('account_holder_name', 'account_number', 'ifsc_code', 'bank_name', 'branch_name', 'account_type')
        }),
        ('System', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ComplianceID)
class ComplianceIDAdmin(admin.ModelAdmin):
    list_display = ('employee', 'compliance_type', 'compliance_id', 'validity_date')
    list_filter = ('compliance_type', 'issued_date', 'validity_date')
    search_fields = ('employee__emp_id', 'compliance_id')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Employee Reference', {
            'fields': ('employee',)
        }),
        ('Compliance Information', {
            'fields': ('compliance_type', 'compliance_id', 'issuing_authority', 'issued_date', 'validity_date')
        }),
        ('System', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(CTCHistory)
class CTCHistoryAdmin(admin.ModelAdmin):
    list_display = ('employee', 'ctc_amount', 'effective_date', 'updated_at')
    list_filter = ('effective_date', 'created_at')
    search_fields = ('employee__emp_id', 'employee__first_name', 'employee__last_name')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Employee Reference', {
            'fields': ('employee',)
        }),
        ('CTC Information', {
            'fields': ('ctc_amount', 'effective_date')
        }),
        ('System', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(PastExperience)
class PastExperienceAdmin(admin.ModelAdmin):
    list_display = ('employee', 'company_name', 'designation', 'start_date', 'end_date')
    list_filter = ('start_date', 'end_date', 'company_name')
    search_fields = ('employee__emp_id', 'company_name', 'designation')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Employee Reference', {
            'fields': ('employee',)
        }),
        ('Experience Information', {
            'fields': ('company_name', 'designation', 'department', 'start_date', 'end_date', 'description')
        }),
        ('System', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
