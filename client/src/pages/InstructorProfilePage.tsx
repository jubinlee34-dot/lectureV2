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
  X,
} from "lucide-react";
import type { InstructorProfile, CustomProfileField } from "../types/instructor";
import { useSupabase } from "../contexts/SupabaseContext";

const defaultProfile: InstructorProfile = {
  name: "",
  homeAddress: "",
  phone: "",
  email: "",
  naverMapClientId: "",
  naverMapClientSecret: "",
  customFields: [
    { id: "bank", label: "주거래 은행 및 계좌번호", value: "" },
    { id: "affiliation", label: "소속 및 직함", value: "" },
    { id: "specialty", label: "주요 강의 분야", value: "" },
  ],
};

export default function InstructorProfilePage() {
  const { profile: dbProfile, updateProfile, uploadLocalDataToSupabase } = useSupabase();
  const [profile, setProfile] = useState<InstructorProfile>(defaultProfile);
  const [showNaverSecret, setShowNaverSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Lock Screen States
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState("");

  // Custom field creation states
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");

  // Sync with DB profile on load
  useEffect(() => {
    if (dbProfile) {
      setProfile({
        ...defaultProfile,
        ...dbProfile,
        customFields: dbProfile.customFields || defaultProfile.customFields,
      });
      // If there is no password set in the DB profile, unlock automatically
      if (!dbProfile.password || dbProfile.password.trim() === "") {
        setIsUnlocked(true);
      }
    } else {
      setIsUnlocked(true);
    }
  }, [dbProfile]);

  const handleUnlock = () => {
    if (dbProfile && enteredPassword === dbProfile.password) {
      setIsUnlocked(true);
      toast.success("프로필 잠금이 해제되었습니다.");
    } else {
      toast.error("비밀번호가 일치하지 않습니다. 다시 시도해 주세요.");
    }
  };

  const handleSearchNaverMap = () => {
    const address = profile.homeAddress.trim();
    if (!address) {
      toast.error("검색할 주소 또는 장소명을 입력해주세요.");
      return;
    }
    const url = `https://map.naver.com/v5/search/${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  };

  const handleSave = async () => {
    try {
      await updateProfile(profile);
      toast.success("강사 프로필 정보가 안전하게 저장되었습니다.");
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

  const hasPassword = !!(dbProfile && dbProfile.password && dbProfile.password.trim() !== "");

  if (hasPassword && !isUnlocked) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border border-border/80 shadow-xl backdrop-blur-md bg-card/75">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Key className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">프로필 잠금 해제</CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              강사 프로필 및 네이버 지도 API 설정을 편집하려면 비밀번호를 입력해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="lock-password">비밀번호</Label>
              <Input
                id="lock-password"
                type="password"
                placeholder="비밀번호 입력"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUnlock();
                }}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 pt-2">
            <Button onClick={handleUnlock} className="w-full shadow-md">
              잠금 해제
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

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
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="profile-address"
                      placeholder="예: 서울특별시 강남구 테헤란로 152"
                      value={profile.homeAddress}
                      onChange={e => handleFieldChange("homeAddress", e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSearchNaverMap}
                    className="shrink-0 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all text-xs h-10 px-3"
                  >
                    네이버 지도 검색
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  * 입력하신 집 주소는 강의 상세 페이지 및 강의 카드에서 네이버 지도 길찾기 연결 시 출발지로 사용됩니다.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 보안 및 데이터 설정 Card */}
          <Card className="border border-border/80 shadow-sm backdrop-blur-sm bg-card/60">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-primary" />
                보안 및 데이터 관리
              </CardTitle>
              <CardDescription>
                프로필 잠금 비밀번호를 설정하거나, 브라우저 로컬 데이터를 Supabase 클라우드로 백업합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Password Setup */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="profile-password-setup" className="text-xs font-semibold">
                    프로필 잠금 비밀번호 설정
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    {showPassword ? (
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
                    id="profile-password-setup"
                    type={showPassword ? "text" : "password"}
                    placeholder="비밀번호 설정 (비워두면 잠금 해제)"
                    value={profile.password || ""}
                    onChange={e => handleFieldChange("password", e.target.value)}
                    className="pl-9 text-sm font-mono"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  * 비밀번호를 설정하면 강사 프로필 페이지 진입 시 비밀번호를 확인하는 잠금 화면이 나타납니다.
                </p>
              </div>

              <Separator className="my-1" />

              {/* Data Migration / Upload */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold block">데이터 백업 및 마이그레이션</Label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  현재 웹 브라우저(localStorage)에 저장되어 있는 모든 강의 일정, 할 일 목록, 준비사항 체크리스트, SMS 발송 이력을 Supabase 클라우드 데이터베이스로 강제 업로드하여 통합(Upsert)합니다.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-xs hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-center gap-1 border-primary/20"
                  onClick={async () => {
                    if (confirm("정말로 로컬 데이터를 Supabase 클라우드로 업로드하시겠습니까? 기존에 동일한 ID를 가진 데이터는 덮어씌워질 수 있습니다.")) {
                      try {
                        await uploadLocalDataToSupabase();
                      } catch (e) {
                        // error is handled inside uploadLocalDataToSupabase
                      }
                    }
                  }}
                >
                  <Save className="h-3.5 w-3.5" />
                  로컬 데이터를 Supabase에 강제 업로드
                </Button>
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
                모든 정보는 Supabase 클라우드 데이터베이스에 실시간 저장됩니다.
              </span>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
