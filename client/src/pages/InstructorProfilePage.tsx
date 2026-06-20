import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSupabase } from "@/contexts/SupabaseContext";
import type { InstructorProfile } from "@/types/instructor";
import { Mail, MapPin, Phone, Save, ShieldCheck, User } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const defaultProfile: InstructorProfile = {
  name: "",
  homeAddress: "",
  phone: "",
  email: "",
  customFields: [],
};

export default function InstructorProfilePage() {
  const { profile: dbProfile, updateProfile } = useSupabase();
  const [profile, setProfile] = useState<InstructorProfile>(defaultProfile);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (dbProfile) setProfile({ ...defaultProfile, ...dbProfile });
  }, [dbProfile]);

  const handleFieldChange = (field: keyof InstructorProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateProfile(profile);
      toast.success("프로필을 저장했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "프로필 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearchNaverMap = () => {
    const address = profile.homeAddress.trim();
    if (!address) {
      toast.error("검색할 주소를 입력해 주세요.");
      return;
    }
    window.open(`https://map.naver.com/v5/search/${encodeURIComponent(address)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">강사 프로필</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          연락처와 출발 주소를 관리합니다. 집 주소가 변경되면 기존 거리/시간은 재계산 필요 상태로 표시됩니다.
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              기본 정보
            </CardTitle>
            <CardDescription>강의 관리와 문자 템플릿에 사용할 정보를 입력합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field icon={User} id="profile-name" label="이름">
              <Input
                id="profile-name"
                value={profile.name}
                onChange={(event) => handleFieldChange("name", event.target.value)}
              />
            </Field>
            <Field icon={Phone} id="profile-phone" label="전화번호">
              <Input
                id="profile-phone"
                value={profile.phone}
                onChange={(event) => handleFieldChange("phone", event.target.value)}
              />
            </Field>
            <Field icon={Mail} id="profile-email" label="이메일">
              <Input
                id="profile-email"
                type="email"
                value={profile.email}
                onChange={(event) => handleFieldChange("email", event.target.value)}
              />
            </Field>
            <Field icon={MapPin} id="profile-address" label="출발 주소">
              <div className="flex gap-2">
                <Input
                  id="profile-address"
                  value={profile.homeAddress}
                  onChange={(event) => handleFieldChange("homeAddress", event.target.value)}
                />
                <Button type="button" variant="outline" onClick={handleSearchNaverMap}>
                  지도 검색
                </Button>
              </div>
            </Field>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              <Save className="mr-1.5 h-4 w-4" />
              {isSaving ? "저장 중" : "저장"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              네이버 API 보안 설정
            </CardTitle>
            <CardDescription>
              Vercel Environment Variables에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 설정하세요. Secret은 브라우저나
              Supabase 공개 테이블에 저장하지 않습니다.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  id,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Label>
      {children}
    </div>
  );
}
