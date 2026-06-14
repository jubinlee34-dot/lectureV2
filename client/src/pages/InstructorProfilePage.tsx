import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Key,
  Plus,
  Trash2,
  Save,
  Info,
  Eye,
  EyeOff,
  ShieldCheck,
  PlusCircle,
  Briefcase,
} from "lucide-react";
import type { InstructorProfile, CustomProfileField } from "../types/instructor";

const PROFILE_KEY = "lecture-archive-instructor-profile";

const defaultProfile: InstructorProfile = {
  name: "",
  homeAddress: "",
  phone: "",
  email: "",
  googleMapsApiKey: "",
  customFields: [
    { id: "bank", label: "주거래 은행 및 계좌번호", value: "" },
    { id: "affiliation", label: "소속 및 직함", value: "" },
    { id: "specialty", label: "주요 강의 분야", value: "" },
  ],
};

export default function InstructorProfilePage() {
  const [profile, setProfile] = useState<InstructorProfile>(defaultProfile);
  const [showApiKey, setShowApiKey] = useState(false);

  // Custom field creation states
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROFILE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as InstructorProfile;
        // Merge with defaults in case of missing fields
        setProfile({
          ...defaultProfile,
          ...parsed,
          customFields: parsed.customFields || defaultProfile.customFields,
        });
      }
    } catch (err) {
      console.error("Failed to load profile", err);
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      toast.success("강사 프로필 정보가 안전하게 저장되었습니다.");
      // Trigger storage event to notify other components
      window.dispatchEvent(new Event("storage"));
    } catch (err) {
      toast.error("프로필 저장에 실패했습니다.");
    }
  };

  const handleFieldChange = (key: keyof Omit<InstructorProfile, "customFields">, val: string) => {
    setProfile(prev => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleCustomFieldChange = (id: string, value: string) => {
    setProfile(prev => ({
      ...prev,
      customFields: prev.customFields.map(f => (f.id === id ? { ...f, value } : f)),
    }));
  };

  const addCustomField = () => {
    if (!newFieldLabel.trim()) {
      toast.error("항목 이름을 입력해주세요.");
      return;
    }

    const newField: CustomProfileField = {
      id: `custom_${Date.now()}`,
      label: newFieldLabel.trim(),
      value: newFieldValue.trim(),
    };

    setProfile(prev => ({
      ...prev,
      customFields: [...prev.customFields, newField],
    }));

    setNewFieldLabel("");
    setNewFieldValue("");
    toast.success(`'${newField.label}' 항목이 추가되었습니다.`);
  };

  const removeCustomField = (id: string, label: string) => {
    setProfile(prev => ({
      ...prev,
      customFields: prev.customFields.filter(f => f.id !== id),
    }));
    toast.success(`'${label}' 항목이 삭제되었습니다.`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">강사 프로필 설정</h1>
          <p className="text-sm text-muted-foreground">
            강사 개인 정보와 개인 강사 업무에 필요한 관리 항목을 입력하고 조율할 수 있습니다.
          </p>
        </div>
        <Button onClick={handleSave} className="w-full sm:w-auto shadow-md transition-all">
          <Save className="mr-2 h-4 w-4" />
          저장하기
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Basic Profile & Google Maps config */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <Card className="border border-border/80 shadow-sm backdrop-blur-sm bg-card/60">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" />
                기본 인적 사항
              </CardTitle>
              <CardDescription>출강 시 매칭 및 안내에 활용될 기본적인 강사 프로필 정보입니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-name" className="text-xs font-semibold">이름</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="profile-name"
                      placeholder="홍길동"
                      value={profile.name}
                      onChange={e => handleFieldChange("name", e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-phone" className="text-xs font-semibold">연락처</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="profile-phone"
                      placeholder="010-1234-5678"
                      value={profile.phone}
                      onChange={e => handleFieldChange("phone", e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email" className="text-xs font-semibold">이메일 주소</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-email"
                    type="email"
                    placeholder="instructor@example.com"
                    value={profile.email}
                    onChange={e => handleFieldChange("email", e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-address" className="text-xs font-semibold">
                  집 주소 (출발지)
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-address"
                    placeholder="예: 서울특별시 강남구 테헤란로 152"
                    value={profile.homeAddress}
                    onChange={e => handleFieldChange("homeAddress", e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  * 입력하신 집 주소는 강의 상세 페이지에서 강의 장소까지의 이동 거리 및 시간(자동차 기준)을 연동/계산할 때 출발지로 사용됩니다.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Google Maps Integration Card */}
          <Card className="border border-border/80 shadow-sm backdrop-blur-sm bg-card/60">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Key className="h-5 w-5 text-primary" />
                  구글 지도 (Google Maps) 연동 설정
                </CardTitle>
                <Badge variant={profile.googleMapsApiKey ? "default" : "outline"} className="text-[10px] px-2 py-0.5">
                  {profile.googleMapsApiKey ? "실시간 조회 활성화" : "시뮬레이션 모드"}
                </Badge>
              </div>
              <CardDescription>
                강의 상세 화면에서 집 주소와 강의 장소 사이의 자동차 예상 이동 시간 및 주행 거리를 구글 지도 API로 실시간 계산하기 위한 설정입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="maps-api-key" className="text-xs font-semibold">
                    Google Maps API Key (선택 사항)
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    {showApiKey ? (
                      <>
                        <EyeOff className="h-3 w-3" /> 숨기기
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" /> 표시
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="maps-api-key"
                    type={showApiKey ? "text" : "password"}
                    placeholder="AIzaSy..."
                    value={profile.googleMapsApiKey || ""}
                    onChange={e => handleFieldChange("googleMapsApiKey", e.target.value)}
                    className="pl-9 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 border border-border/50 p-3 flex gap-2.5">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                  <p>
                    <strong>API 키가 없으신가요?</strong> 키 입력을 비워두셔도 거리 시뮬레이션 모드가 동작하여 대략적인 이동 통계가 보이며, 
                    상세 페이지에서 제공하는 <span className="font-semibold text-foreground">구글 지도 길찾기 바로가기</span> 버튼을 통해 무료로 실시간 실 주행 거리와 소요 시간을 구글 맵 앱/웹에서 확인할 수 있습니다.
                  </p>
                  <p>
                    <strong>API 키 발급처:</strong> Google Cloud Console 에서 &quot;Distance Matrix API&quot; 및 &quot;Maps JavaScript API&quot; 가 활성화된 브라우저 API Key를 발급받아 입력하시면 이 앱 내부에서 실시간 정보가 바로 렌더링됩니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Dynamic Business/Work Items */}
        <div className="space-y-6">
          <Card className="border border-border/80 shadow-sm backdrop-blur-sm bg-card/60 h-full flex flex-col">
            <CardHeader className="pb-4 shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5 text-primary" />
                강사 업무용 등록 항목
              </CardTitle>
              <CardDescription>
                개인 강사 업무에 필요한 중요 정보(계좌 정보, 소속, 주요 준비물 등)를 등록하고 관리하는 영역입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 overflow-y-auto">
              {/* Dynamic input fields list */}
              <div className="space-y-4">
                {profile.customFields.map((field) => (
                  <div key={field.id} className="space-y-1.5 p-3 rounded-lg border border-border bg-background/40 group relative transition-all hover:bg-background/80">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`custom-field-${field.id}`} className="text-xs font-semibold text-foreground/90">
                        {field.label}
                      </Label>
                      <button
                        type="button"
                        onClick={() => removeCustomField(field.id, field.label)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-destructive hover:bg-destructive/10 rounded transition-all"
                        title="항목 삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Input
                      id={`custom-field-${field.id}`}
                      placeholder={`${field.label} 내용을 입력하세요`}
                      value={field.value}
                      onChange={e => handleCustomFieldChange(field.id, e.target.value)}
                      className="h-8 text-xs dark:bg-background/40"
                    />
                  </div>
                ))}

                {profile.customFields.length === 0 && (
                  <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg bg-background/10">
                    등록된 강사 업무 관리 항목이 없습니다.
                  </div>
                )}
              </div>

              <Separator className="my-2" />

              {/* Form to add a new custom field */}
              <div className="space-y-3 p-3.5 rounded-lg border border-primary/20 bg-primary/5">
                <span className="text-xs font-bold text-primary flex items-center gap-1">
                  <PlusCircle className="h-3.5 w-3.5" /> 새 업무 항목 추가
                </span>
                <div className="space-y-2">
                  <Input
                    placeholder="항목 이름 (예: 보유 자격증, 주소속)"
                    value={newFieldLabel}
                    onChange={e => setNewFieldLabel(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                  <Input
                    placeholder="내용 (예: 평생교육사 2급, OOO 아카데미)"
                    value={newFieldValue}
                    onChange={e => setNewFieldValue(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                  <Button
                    type="button"
                    onClick={addCustomField}
                    size="sm"
                    className="w-full h-8 text-xs"
                    variant="secondary"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> 항목 추가하기
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pb-4 pt-2 shrink-0 flex items-center justify-between border-t border-border/40 mt-auto bg-muted/20 rounded-b-xl px-4 py-2.5">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                모든 정보는 로컬 브라우저에 저장됩니다.
              </span>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
