from rest_framework import serializers
from .models import Employee, BankDetail, ComplianceID, CTCHistory, PastExperience, OnboardingChecklist


class EmployeeSerializer(serializers.ModelSerializer):
    # Make optional fields explicitly nullable
    phone = serializers.CharField(allow_blank=True, required=False, allow_null=True)
    department = serializers.CharField(allow_blank=True, required=False, allow_null=True)
    designation = serializers.CharField(allow_blank=True, required=False, allow_null=True)
    exit_date = serializers.DateField(required=False, allow_null=True)
    
    class Meta:
        model = Employee
        fields = [
            'id', 'emp_id', 'first_name', 'last_name', 'email', 
            'phone', 'department', 'designation', 'joining_date', 
            'exit_date', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BankDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankDetail
        fields = [
            'id', 'account_holder_name', 'account_number', 'ifsc_code',
            'bank_name', 'branch_name', 'account_type', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ComplianceIDSerializer(serializers.ModelSerializer):
    compliance_type_display = serializers.CharField(source='get_compliance_type_display', read_only=True)
    
    class Meta:
        model = ComplianceID
        fields = [
            'id', 'compliance_type', 'compliance_type_display', 'compliance_id',
            'issued_date', 'validity_date', 'issuing_authority', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CTCHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CTCHistory
        fields = [
            'id', 'ctc_amount', 'effective_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PastExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = PastExperience
        fields = [
            'id', 'company_name', 'designation', 'department',
            'start_date', 'end_date', 'description', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class OnboardingChecklistSerializer(serializers.ModelSerializer):
    item_name_display = serializers.CharField(source='get_item_name_display', read_only=True)
    
    class Meta:
        model = OnboardingChecklist
        fields = [
            'id', 'item_name', 'item_name_display', 'is_completed',
            'document_url', 'completed_date', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmployeeProfileSerializer(serializers.ModelSerializer):
    """Unified employee profile combining all related data"""
    bank_detail = BankDetailSerializer(read_only=True)
    compliance_ids = ComplianceIDSerializer(many=True, read_only=True)
    ctc_history = CTCHistorySerializer(many=True, read_only=True)
    past_experiences = PastExperienceSerializer(many=True, read_only=True)
    onboarding_checklist = OnboardingChecklistSerializer(many=True, read_only=True)
    current_ctc = serializers.SerializerMethodField()
    onboarding_completion = serializers.SerializerMethodField()
    
    class Meta:
        model = Employee
        fields = [
            'id', 'emp_id', 'first_name', 'last_name', 'email', 
            'phone', 'department', 'designation', 'joining_date', 
            'exit_date', 'status', 'current_ctc', 'onboarding_completion',
            'bank_detail', 'compliance_ids', 'ctc_history', 'past_experiences',
            'onboarding_checklist', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_current_ctc(self, obj):
        """Get the most recent CTC amount"""
        latest_ctc = obj.ctc_history.first()
        if latest_ctc:
            return {
                'amount': str(latest_ctc.ctc_amount),
                'effective_date': latest_ctc.effective_date
            }
        return None

    def get_onboarding_completion(self, obj):
        """Get onboarding completion percentage"""
        checklist = obj.onboarding_checklist.all()
        if not checklist:
            return {'completed': 0, 'total': 0, 'percentage': 0}
        total = checklist.count()
        completed = checklist.filter(is_completed=True).count()
        percentage = (completed / total * 100) if total > 0 else 0
        return {
            'completed': completed,
            'total': total,
            'percentage': round(percentage, 2)
        }
